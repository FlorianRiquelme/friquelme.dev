import * as cdk from 'aws-cdk-lib';
import { StaticSiteStack } from './static-site-stack';
import { PreviewStack } from './preview-stack';
import { GitHubOidcStack } from './github-oidc-stack';

/** Wires the stacks together. Used by bin/infra.ts and by the tests, so both see the same wiring. */
export function buildApp(app: cdk.App, env: cdk.Environment) {
  const site = new StaticSiteStack(app, 'PortfolioSiteStack', { env });
  const preview = new PreviewStack(app, 'PortfolioPreviewStack', { env });
  const oidc = new GitHubOidcStack(app, 'PortfolioOidcStack', {
    env,
    bucket: site.bucket,
    previewBucket: preview.bucket,
    distribution: site.distribution,
  });
  return { site, preview, oidc };
}
