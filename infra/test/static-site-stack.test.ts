import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, it, expect, beforeAll } from 'vitest';
import { StaticSiteStack } from '../lib/static-site-stack';

const TEST_ACCOUNT = '123456789012';
const TEST_REGION = 'us-east-1';
const HOSTED_ZONE_CONTEXT_KEY =
  `hosted-zone:account=${TEST_ACCOUNT}:domainName=friquelme.dev:region=${TEST_REGION}`;

function synth() {
  const app = new cdk.App({
    context: {
      [HOSTED_ZONE_CONTEXT_KEY]: {
        Id: '/hostedzone/TESTHOSTEDZONEID',
        Name: 'friquelme.dev.',
      },
    },
  });
  const stack = new StaticSiteStack(app, 'TestStaticSiteStack', {
    env: { account: TEST_ACCOUNT, region: TEST_REGION },
  });
  return Template.fromStack(stack);
}

describe('StaticSiteStack ResponseHeadersPolicy', () => {
  let template: Template;

  beforeAll(() => {
    template = synth();
  });

  it('declares exactly one ResponseHeadersPolicy', () => {
    template.resourceCountIs(
      'AWS::CloudFront::ResponseHeadersPolicy',
      1,
    );
  });

  it('sets a Content-Security-Policy that allows PostHog', () => {
    template.hasResourceProperties(
      'AWS::CloudFront::ResponseHeadersPolicy',
      {
        ResponseHeadersPolicyConfig: {
          SecurityHeadersConfig: {
            ContentSecurityPolicy: {
              ContentSecurityPolicy: Match.stringLikeRegexp(
                'https://\\*\\.posthog\\.com',
              ),
              Override: true,
            },
          },
        },
      },
    );
  });

  it('CSP includes upgrade-insecure-requests', () => {
    template.hasResourceProperties(
      'AWS::CloudFront::ResponseHeadersPolicy',
      {
        ResponseHeadersPolicyConfig: {
          SecurityHeadersConfig: {
            ContentSecurityPolicy: {
              ContentSecurityPolicy: Match.stringLikeRegexp(
                'upgrade-insecure-requests',
              ),
            },
          },
        },
      },
    );
  });

  it("CSP includes frame-ancestors 'none'", () => {
    template.hasResourceProperties(
      'AWS::CloudFront::ResponseHeadersPolicy',
      {
        ResponseHeadersPolicyConfig: {
          SecurityHeadersConfig: {
            ContentSecurityPolicy: {
              ContentSecurityPolicy: Match.stringLikeRegexp(
                "frame-ancestors 'none'",
              ),
            },
          },
        },
      },
    );
  });

  it('declares a Permissions-Policy custom header', () => {
    template.hasResourceProperties(
      'AWS::CloudFront::ResponseHeadersPolicy',
      {
        ResponseHeadersPolicyConfig: {
          CustomHeadersConfig: {
            Items: Match.arrayWith([
              Match.objectLike({
                Header: 'Permissions-Policy',
                Value: Match.stringLikeRegexp('camera=\\(\\)'),
                Override: true,
              }),
            ]),
          },
        },
      },
    );
  });

  it('keeps the existing HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy', () => {
    template.hasResourceProperties(
      'AWS::CloudFront::ResponseHeadersPolicy',
      {
        ResponseHeadersPolicyConfig: {
          SecurityHeadersConfig: {
            StrictTransportSecurity: Match.objectLike({
              AccessControlMaxAgeSec: 63072000,
              IncludeSubdomains: true,
              Preload: true,
            }),
            ContentTypeOptions: Match.objectLike({ Override: true }),
            FrameOptions: Match.objectLike({
              FrameOption: 'DENY',
              Override: true,
            }),
            ReferrerPolicy: Match.objectLike({
              ReferrerPolicy: 'strict-origin-when-cross-origin',
            }),
          },
        },
      },
    );
  });
});
