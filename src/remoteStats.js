import { remoteConfig } from './remoteConfig.js';
import { signRequestHeaders } from './sigv4.js';

// Talks to Cognito Identity + DynamoDB directly over signed HTTPS requests.
//
// History of two rejected approaches, kept here so nobody re-tries them:
// 1. Full AWS SDK v3 packages loaded via esm.sh - both the DocumentClient
//    (`@aws-sdk/lib-dynamodb`) and the raw `@aws-sdk/client-dynamodb` throw at
//    request time, because the SDK's default client setup unconditionally
//    runs a shared-config-file lookup (@smithy/shared-ini-file-loader) that
//    assumes a real Node `fs` module - esm.sh's browser polyfill for
//    `fs.readFile` just throws instead of emulating "file not found".
// 2. aws4fetch (a tiny, otherwise-great SigV4 signer) - it depends on
//    crypto.subtle, which only exists in a secure context (HTTPS, or
//    localhost as a special exception). This site is HTTP-only, so
//    crypto.subtle is undefined there and every signed request throws before
//    it reaches AWS. Confirmed by testing the live site directly, not a
//    hypothetical - it worked fine everywhere it was tested from localhost.
//
// signRequestHeaders (./sigv4.js) implements SHA-256/HMAC-SHA256 in pure JS,
// so signing works on any origin regardless of secure-context status.
let credentialsPromise = null;
let credentialsExpireAt = 0;
let initFailed = false;

function isConfigured() {
  return Boolean(
    remoteConfig.region && remoteConfig.identityPoolId && remoteConfig.tableName
  );
}

function withTimeout(promise, ms = 4000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);
}

function marshall(obj) {
  const item = {};
  for (const [key, value] of Object.entries(obj)) {
    item[key] = typeof value === 'number' ? { N: String(value) } : { S: String(value) };
  }
  return item;
}

function unmarshall(item) {
  const obj = {};
  for (const [key, value] of Object.entries(item || {})) {
    if (value.N !== undefined) obj[key] = Number(value.N);
    else if (value.S !== undefined) obj[key] = value.S;
  }
  return obj;
}

async function getIdentityCredentials() {
  const base = `https://cognito-identity.${remoteConfig.region}.amazonaws.com/`;

  const idRes = await fetch(base, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'AWSCognitoIdentityService.GetId'
    },
    body: JSON.stringify({ IdentityPoolId: remoteConfig.identityPoolId })
  });
  if (!idRes.ok) throw new Error(`GetId failed: ${idRes.status}`);
  const { IdentityId } = await idRes.json();

  const credsRes = await fetch(base, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'AWSCognitoIdentityService.GetCredentialsForIdentity'
    },
    body: JSON.stringify({ IdentityId })
  });
  if (!credsRes.ok) throw new Error(`GetCredentialsForIdentity failed: ${credsRes.status}`);
  const { Credentials } = await credsRes.json();
  return Credentials; // { AccessKeyId, SecretKey, SessionToken, Expiration }
}

async function getCredentials() {
  if (initFailed || !isConfigured()) return null;

  const now = Date.now() / 1000;
  if (credentialsPromise && now < credentialsExpireAt - 60) {
    return credentialsPromise;
  }

  credentialsPromise = withTimeout(getIdentityCredentials());

  try {
    const creds = await credentialsPromise;
    credentialsExpireAt = creds.Expiration;
    return creds;
  } catch (err) {
    console.warn('Whack: remote stats backend unavailable, playing locally.', err);
    initFailed = true;
    credentialsPromise = null;
    return null;
  }
}

async function callDynamoDb(target, body) {
  const creds = await getCredentials();
  if (!creds) return null;
  try {
    const url = `https://dynamodb.${remoteConfig.region}.amazonaws.com/`;
    const bodyText = JSON.stringify(body);
    const signedHeaders = signRequestHeaders({
      method: 'POST',
      url,
      region: remoteConfig.region,
      service: 'dynamodb',
      headers: {
        'Content-Type': 'application/x-amz-json-1.0',
        'X-Amz-Target': `DynamoDB_20120810.${target}`
      },
      body: bodyText,
      accessKeyId: creds.AccessKeyId,
      secretAccessKey: creds.SecretKey,
      sessionToken: creds.SessionToken
    });

    const res = await withTimeout(
      fetch(url, { method: 'POST', headers: signedHeaders, body: bodyText })
    );
    if (!res.ok) {
      console.warn(`Whack: DynamoDB ${target} failed`, res.status, await res.text());
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn(`Whack: DynamoDB ${target} failed.`, err);
    return null;
  }
}

// Query by partition key only, Select:COUNT - matches the IAM policy
// statement that permits this specific query shape without returning any
// attributes (including password) back to the caller.
export async function checkUsernameExists(username) {
  const result = await callDynamoDb('Query', {
    TableName: remoteConfig.tableName,
    KeyConditionExpression: 'username = :u',
    ExpressionAttributeValues: { ':u': { S: username } },
    Select: 'COUNT'
  });
  return result ? result.Count > 0 : null;
}

// GetItem with the full guessed key. An empty result is ambiguous (brand-new
// username, or an existing one with the wrong password) - checkUsernameExists
// disambiguates it.
export async function loginRemote(username, password) {
  const result = await callDynamoDb('GetItem', {
    TableName: remoteConfig.tableName,
    Key: { username: { S: username }, password: { S: password } }
  });
  if (result === null) return null; // network/backend failure
  if (result.Item) {
    return { found: true, stats: unmarshall(result.Item) };
  }
  const exists = await checkUsernameExists(username);
  return { found: false, wrongPassword: exists === true };
}

// First-time write for a brand-new username+password pair. The condition
// only guards a same-key double-submit race, not username squatting under a
// different password - see the note in the plan/README about why DynamoDB
// can't enforce that with this key layout.
export async function registerRemote(username, password, stats) {
  const result = await callDynamoDb('PutItem', {
    TableName: remoteConfig.tableName,
    Item: marshall({ username, password, leaderboardType: 'ALL', ...stats }),
    ConditionExpression: 'attribute_not_exists(username)'
  });
  return result !== null;
}

// Ongoing updates for an already-logged-in session - no condition needed,
// the key was already validated by loginRemote.
export async function saveRemoteStats(username, password, stats) {
  const result = await callDynamoDb('PutItem', {
    TableName: remoteConfig.tableName,
    Item: marshall({ username, password, leaderboardType: 'ALL', ...stats })
  });
  return result !== null;
}

// Query on the leaderboard GSI - constant partition key, sorted by gamesWon
// descending. ProjectionExpression must stay limited to this allow-list to
// satisfy the IAM policy. Select:SPECIFIC_ATTRIBUTES must be sent explicitly -
// DynamoDB accepts it as implied by ProjectionExpression alone, but the IAM
// dynamodb:Select condition key isn't populated unless the request sends it,
// so leaving it out gets denied even though the query itself would succeed.
export async function fetchLeaderboard() {
  const result = await callDynamoDb('Query', {
    TableName: remoteConfig.tableName,
    IndexName: remoteConfig.leaderboardIndexName,
    KeyConditionExpression: 'leaderboardType = :lt',
    ExpressionAttributeValues: { ':lt': { S: 'ALL' } },
    ProjectionExpression: 'username, gamesWon, xp, badge',
    Select: 'SPECIFIC_ATTRIBUTES',
    ScanIndexForward: false,
    Limit: 5
  });
  return result ? result.Items.map(unmarshall) : null;
}
