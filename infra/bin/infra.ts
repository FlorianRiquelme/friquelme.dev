#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { StaticSiteStack } from '../lib/static-site-stack';
import { GitHubOidcStack } from '../lib/github-oidc-stack';

const app = new cdk.App();

// ACM certificates for CloudFront must be in us-east-1
const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'us-east-1',
};

const site = new StaticSiteStack(app, 'PortfolioSiteStack', { env });

new GitHubOidcStack(app, 'PortfolioOidcStack', {
  env,
  bucket: site.bucket,
  distribution: site.distribution,
});
