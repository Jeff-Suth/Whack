# Whack!

- Based on the popular NYT Wordle game comes Whack!
- Instead of using an API to get a new word, just pulls from a list of words kept inside the project.

# Local Testing
- python -m http.server
- http://localhost:8000/
- CTRL + C (Windows) to close the server in the terminal so you can refresh the service with new changes.
- In browser, CTRL + SHIFT + R to force reload.
- Clear user data in browser console using `localStorage.removeItem('yourUsername');`

# XP, Rank & Leaderboard

Every correct guess earns XP (more for fewer guesses), which levels a player up through nine badges: Iron, Bronze, Silver, Gold, Platinum, Diamond, Master, Grandmaster, Challenger (see `src/ranks.js` for the exact curve). Stats optionally sync to a DynamoDB table so they follow a player across devices, and a Leaderboard button shows the top 5 players by wins.

This part is entirely optional - with no backend deployed, the game plays exactly as before, tracking stats in `localStorage` only. To turn on cross-device sync and the leaderboard:

1. `cd infra && npm install && npx cdk synth` (sanity check the stack builds before deploying)
2. `npx cdk deploy` (needs AWS credentials configured, e.g. via `aws configure`)
3. Copy the four values CDK prints out (`IdentityPoolId`, `TableName`, `LeaderboardIndexName`, `Region`) into `src/remoteConfig.js`
4. Re-deploy the site (`aws s3 sync ...`) so the filled-in config goes live

**Security note:** the backing table uses `username` as the partition key and `password` as the sort key - a deliberate, lightweight "shared secret" instead of real hashed authentication. That's a conscious tradeoff for a for-fun project with no sensitive data, not a login system - don't reuse a real password here. Full reasoning is in the plan history / `infra/lib/whack-stack.js` comments.

# TODO
- Add single daily XP bonus (scales with days done in a row)
- Add xp bonus for every 5 in a row you solve without losing
- Add a spinning wheel after wins that will start with a 10% chance to give in game currency
- Add in game shop that can give you 2x XP for an hour, combo freezes for if you miss a day