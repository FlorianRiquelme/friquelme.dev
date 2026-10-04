import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { StaticSiteStack } from '../lib/static-site-stack';
import { PreviewStack } from '../lib/preview-stack';
import { GitHubOidcStack } from '../lib/github-oidc-stack';

export const TEST_ACCOUNT = '123456789012';
export const TEST_REGION = 'us-east-1';

/** Synthesizes the three stacks the way bin/infra.ts wires them, with a stubbed hosted-zone lookup. */
export function synthAll() {
  const app = new cdk.App({
    context: {
      [`hosted-zone:account=${TEST_ACCOUNT}:domainName=friquelme.dev:region=${TEST_REGION}`]: {
        Id: '/hostedzone/TESTHOSTEDZONEID',
        Name: 'friquelme.dev.',
      },
    },
  });
  const env = { account: TEST_ACCOUNT, region: TEST_REGION };
  const site = new StaticSiteStack(app, 'TestSite', { env });
  const preview = new PreviewStack(app, 'TestPreview', { env });
  const oidc = new GitHubOidcStack(app, 'TestOidc', {
    env,
    bucket: site.bucket,
    previewBucket: preview.bucket,
    distribution: site.distribution,
  });
  return {
    site: Template.fromStack(site),
    preview: Template.fromStack(preview),
    oidc: Template.fromStack(oidc),
  };
}
