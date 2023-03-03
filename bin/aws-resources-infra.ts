#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { config } from '../lib/config';
import { LambdaToDynamoStack } from '../lib/lambda-to-dynamodb-stack';

DeployStack();

// Pass all the config to the stack and build the stack
export function DeployStack() : LambdaToDynamoStack {
  const app = new cdk.App();
  const stack = new LambdaToDynamoStack(app, config.stackName, {
    env: { account: config.aws.account, region: config.aws.region },
  });
  return stack;
}
