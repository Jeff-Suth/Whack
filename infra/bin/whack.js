#!/usr/bin/env node
const cdk = require('aws-cdk-lib');
const { WhackStack } = require('../lib/whack-stack');

const app = new cdk.App();
new WhackStack(app, 'WhackStack', {
  /* Uncomment and set explicitly if you want a fixed account/region instead
     of picking up the ones configured for your default AWS CLI profile.
  env: { account: '123456789012', region: 'us-east-1' },
  */
});
