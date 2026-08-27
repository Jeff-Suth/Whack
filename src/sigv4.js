// Minimal pure-JavaScript AWS SigV4 request signer.
//
// The Web Crypto API (crypto.subtle), which the aws4fetch library relies on
// for signing, only exists in a "secure context" - HTTPS, or localhost as a
// special exception. This site is served over plain HTTP (no CloudFront/ACM
// cert in front of the bucket), so crypto.subtle is undefined there and every
// signed request throws before it reaches AWS. This module implements SHA-256
// and HMAC-SHA256 itself so signing works on any origin, secure or not.

function rightRotate(value, amount) {
  return (value >>> amount) | (value << (32 - amount));
}

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

function sha256(bytes) {
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ]);

  const dataLen = bytes.length;
  const bitLen = dataLen * 8;

  let paddedLen = dataLen + 1;
  while (paddedLen % 64 !== 56) paddedLen++;
  paddedLen += 8;

  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[dataLen] = 0x80;

  const view = new DataView(padded.buffer);
  const high = Math.floor(bitLen / 0x100000000);
  const low = bitLen >>> 0;
  view.setUint32(paddedLen - 8, high, false);
  view.setUint32(paddedLen - 4, low, false);

  const w = new Uint32Array(64);

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, hh] = h;

    for (let i = 0; i < 64; i++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }

  const result = new Uint8Array(32);
  const resultView = new DataView(result.buffer);
  for (let i = 0; i < 8; i++) resultView.setUint32(i * 4, h[i], false);
  return result;
}

function concatBytes(...arrays) {
  const total = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

function hmacSha256(key, message) {
  const blockSize = 64;
  let keyBytes = key.length > blockSize ? sha256(key) : key;
  if (keyBytes.length < blockSize) {
    const padded = new Uint8Array(blockSize);
    padded.set(keyBytes);
    keyBytes = padded;
  }

  const oKeyPad = new Uint8Array(blockSize);
  const iKeyPad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    oKeyPad[i] = keyBytes[i] ^ 0x5c;
    iKeyPad[i] = keyBytes[i] ^ 0x36;
  }

  const innerHash = sha256(concatBytes(iKeyPad, message));
  return sha256(concatBytes(oKeyPad, innerHash));
}

function toHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function utf8Encode(str) {
  return new TextEncoder().encode(str);
}

function getSignatureKey(secretAccessKey, dateStamp, region, service) {
  const kDate = hmacSha256(utf8Encode('AWS4' + secretAccessKey), utf8Encode(dateStamp));
  const kRegion = hmacSha256(kDate, utf8Encode(region));
  const kService = hmacSha256(kRegion, utf8Encode(service));
  return hmacSha256(kService, utf8Encode('aws4_request'));
}

// Returns the full header set (including Authorization) to send with the
// request. Does NOT include Host - that's a forbidden header name for
// fetch()/XHR to set explicitly, but the browser sends it automatically
// matching the URL, which is exactly the value used in the signature.
export function signRequestHeaders({
  method,
  url,
  region,
  service,
  headers = {},
  body = '',
  accessKeyId,
  secretAccessKey,
  sessionToken
}) {
  const urlObj = new URL(url);
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const bodyBytes = utf8Encode(body || '');
  const payloadHash = toHex(sha256(bodyBytes));

  const headerMap = {};
  for (const [key, value] of Object.entries(headers)) {
    headerMap[key.toLowerCase()] = String(value).trim();
  }
  headerMap.host = urlObj.host;
  headerMap['x-amz-date'] = amzDate;
  headerMap['x-amz-content-sha256'] = payloadHash;
  if (sessionToken) {
    headerMap['x-amz-security-token'] = sessionToken;
  }

  const sortedHeaderNames = Object.keys(headerMap).sort();
  const canonicalHeaders = sortedHeaderNames.map((name) => `${name}:${headerMap[name]}\n`).join('');
  const signedHeaders = sortedHeaderNames.join(';');

  const canonicalRequest = [
    method.toUpperCase(),
    urlObj.pathname || '/',
    '', // no query string params on any of our requests
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    toHex(sha256(utf8Encode(canonicalRequest)))
  ].join('\n');

  const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature = toHex(hmacSha256(signingKey, utf8Encode(stringToSign)));

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    ...headers,
    'X-Amz-Date': amzDate,
    'X-Amz-Content-Sha256': payloadHash,
    ...(sessionToken ? { 'X-Amz-Security-Token': sessionToken } : {}),
    Authorization: authorization
  };
}
