import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { buildApp } from '../lib/app';

export const TEST_ACCOUNT = '123456789012';
export const TEST_REGION = 'us-east-1';

/** Synthesizes the app exactly as bin/infra.ts wires it, with a stubbed hosted-zone lookup. */
export function synthAll() {
  const app = new cdk.App({
    context: {
      [`hosted-zone:account=${TEST_ACCOUNT}:domainName=friquelme.dev:region=${TEST_REGION}`]: {
        Id: '/hostedzone/TESTHOSTEDZONEID',
        Name: 'friquelme.dev.',
      },
    },
  });
  const stacks = buildApp(app, { account: TEST_ACCOUNT, region: TEST_REGION });
  return {
    site: Template.fromStack(stacks.site),
    preview: Template.fromStack(stacks.preview),
    oidc: Template.fromStack(stacks.oidc),
  };
}
