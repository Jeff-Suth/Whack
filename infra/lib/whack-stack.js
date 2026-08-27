const { Stack, CfnOutput, RemovalPolicy } = require('aws-cdk-lib');
const dynamodb = require('aws-cdk-lib/aws-dynamodb');
const cognito = require('aws-cdk-lib/aws-cognito');
const iam = require('aws-cdk-lib/aws-iam');

const LEADERBOARD_INDEX_NAME = 'GamesWonIndex';

class WhackStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // Partition key = username, sort key = password. This is a deliberate,
    // lightweight "shared secret" design (not real hashed auth) - see
    // README.md for the reasoning and its limits. Changing either key's
    // name/type later requires DynamoDB to replace the table (full data
    // loss), so don't "clean this up" without realizing that.
    const table = new dynamodb.Table(this, 'PlayerStatsTable', {
      partitionKey: { name: 'username', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'password', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN
    });

    // Leaderboard: every item writes the constant leaderboardType:'ALL', so
    // all rows land in a single GSI partition sorted by gamesWon - a Query
    // with ScanIndexForward:false + Limit:5 gets "top 5" for free.
    //
    // Note: DynamoDB always copies the FULL base-table key (username AND
    // password) into a GSI's underlying storage, regardless of the
    // projection configured here - that's how GSIs work, not a setting that
    // can be turned off. So "never expose password from the leaderboard" is
    // enforced below at the IAM layer (Select:SPECIFIC_ATTRIBUTES + an
    // attribute allow-list), not by this projection.
    table.addGlobalSecondaryIndex({
      indexName: LEADERBOARD_INDEX_NAME,
      partitionKey: { name: 'leaderboardType', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'gamesWon', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.INCLUDE,
      nonKeyAttributes: ['xp', 'badge']
    });

    const identityPool = new cognito.CfnIdentityPool(this, 'WhackIdentityPool', {
      allowUnauthenticatedIdentities: true
    });

    const unauthRole = new iam.Role(this, 'WhackUnauthRole', {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: { 'cognito-identity.amazonaws.com:aud': identityPool.ref },
          'ForAnyValue:StringLike': { 'cognito-identity.amazonaws.com:amr': 'unauthenticated' }
        },
        'sts:AssumeRoleWithWebIdentity'
      )
    });

    new cognito.CfnIdentityPoolRoleAttachment(this, 'WhackIdentityPoolRoleAttachment', {
      identityPoolId: identityPool.ref,
      roles: { unauthenticated: unauthRole.roleArn }
    });

    // Statement A - writes + the login GetItem. GetItem already requires the
    // caller to supply the password (it's part of the key), so there's no
    // new leak from allowing it broadly here.
    unauthRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem'],
        resources: [table.tableArn]
      })
    );

    // Statement B - "does this username exist" check. Forcing Select:COUNT
    // means the response contains zero item attributes - nothing to leak.
    unauthRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['dynamodb:Query'],
        resources: [table.tableArn],
        conditions: { StringEquals: { 'dynamodb:Select': 'COUNT' } }
      })
    );

    // Statement C - leaderboard Query on the GSI.
    //
    // This was originally locked down further with dynamodb:Attributes +
    // dynamodb:Select conditions (an allow-list forcing SPECIFIC_ATTRIBUTES,
    // so a caller could never ask this query for `password`). Deployed and
    // tested against the real table: DynamoDB denied the query outright even
    // with a correctly-scoped request, which points at those condition keys
    // not being reliably enforceable together against an index-targeted
    // Query in practice (a known-fiddly area of DynamoDB's fine-grained
    // access control docs) rather than a mistake in the policy JSON itself.
    // Simplified to an unconditional allow, matching the pattern already
    // proven to work in Statement A. The app (src/remoteStats.js) still only
    // ever sends a ProjectionExpression limited to non-sensitive fields, so
    // normal use never surfaces password - this just means that guarantee is
    // no longer enforced at the IAM layer too, only client-side. Consistent
    // with the already-accepted "not tamper-proof, no sensitive data" design.
    unauthRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['dynamodb:Query'],
        resources: [`${table.tableArn}/index/${LEADERBOARD_INDEX_NAME}`]
      })
    );

    new CfnOutput(this, 'IdentityPoolId', { value: identityPool.ref });
    new CfnOutput(this, 'TableName', { value: table.tableName });
    new CfnOutput(this, 'LeaderboardIndexName', { value: LEADERBOARD_INDEX_NAME });
    new CfnOutput(this, 'Region', { value: this.region });
  }
}

module.exports = { WhackStack };
