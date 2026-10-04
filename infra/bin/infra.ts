#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { buildApp } from '../lib/app';

const app = new cdk.App();

// ACM certificates for CloudFront must be in us-east-1
const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'us-east-1',
};

buildApp(app, env);
