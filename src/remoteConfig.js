// Filled in after deploying the infra/ CDK stack (`cd infra && npm install && npx cdk deploy`).
// Copy the four stack outputs here. Left blank, the game runs entirely on local
// stats (src/user.js) - remoteStats.js treats a missing identityPoolId/tableName
// as "no backend configured" and never attempts a network call.
export const remoteConfig = {
  region: 'us-west-2',
  identityPoolId: 'us-west-2:e68be288-5bb5-4e9f-b201-28e71ae02427',
  tableName: 'WhackStack-PlayerStatsTable817F8DE7-1YK1FR1N6UFH',
  leaderboardIndexName: 'GamesWonIndex'
};
