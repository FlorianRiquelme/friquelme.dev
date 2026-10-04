import { describe, it, expect, beforeAll } from 'vitest';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { synthAll } from './app';
import { CONTENT_SECURITY_POLICY, PREVIEW_ROBOTS_TAG } from '../../src/lib/security/headers';

describe('PreviewStack', () => {
  let site: Template;
  let preview: Template;

  beforeAll(() => {
    ({ site, preview } = synthAll());
  });

  const policyConfig = (template: Template) => {
    const policies = Object.values(template.findResources('AWS::CloudFront::ResponseHeadersPolicy'));
    expect(policies).toHaveLength(1);
    return (policies[0] as any).Properties.ResponseHeadersPolicyConfig;
  };

  it('serves the production headers plus X-Robots-Tag, and nothing else differs', () => {
    const production = policyConfig(site);
    const previewConfig = policyConfig(preview);
    const { Name: _productionName, ...productionRest } = production;
    const { Name: _previewName, CustomHeadersConfig, ...previewRest } = previewConfig;
    const { CustomHeadersConfig: productionCustom, ...productionOthers } = productionRest;
    expect(previewRest).toEqual(productionOthers);
    expect(CustomHeadersConfig.Items).toEqual([
      ...productionCustom.Items,
      { Header: 'X-Robots-Tag', Override: true, Value: PREVIEW_ROBOTS_TAG },
    ]);
    expect(previewRest.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy).toBe(CONTENT_SECURITY_POLICY);
  });

  it('keeps production free of X-Robots-Tag', () => {
    expect(JSON.stringify(policyConfig(site))).not.toContain('X-Robots-Tag');
  });

  it('attaches the policy to the default behavior of the distribution', () => {
    const [policyId] = Object.keys(preview.findResources('AWS::CloudFront::ResponseHeadersPolicy'));
    preview.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        DefaultCacheBehavior: Match.objectLike({
          ResponseHeadersPolicyId: { Ref: policyId },
        }),
      },
    });
  });

  it('blocks all public access to a TLS-only bucket', () => {
    preview.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
      LifecycleConfiguration: {
        Rules: [Match.objectLike({ ExpirationInDays: 14, Status: 'Enabled' })],
      },
    });
    preview.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: 'Deny',
            Action: 's3:*',
            Condition: { Bool: { 'aws:SecureTransport': 'false' } },
          }),
        ]),
      },
    });
  });

  it('reads the bucket through origin access control, not a website endpoint', () => {
    preview.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
    const [distribution] = Object.values(preview.findResources('AWS::CloudFront::Distribution')) as any[];
    const [origin] = distribution.Properties.DistributionConfig.Origins;
    expect(origin.S3OriginConfig).toBeDefined();
    expect(origin.CustomOriginConfig).toBeUndefined();
    expect(origin.OriginAccessControlId).toBeDefined();
  });

  it('disables caching and routes viewer requests through the router function', () => {
    const [policy] = Object.values(preview.findResources('AWS::CloudFront::Distribution')) as any[];
    const behavior = policy.Properties.DistributionConfig.DefaultCacheBehavior;
    // Managed CachePolicy "CachingDisabled"
    expect(behavior.CachePolicyId).toBe('4135ea2d-6df8-44a3-9df3-4b5a84be39ad');
    expect(behavior.FunctionAssociations).toHaveLength(1);
    expect(behavior.FunctionAssociations[0].EventType).toBe('viewer-request');
    preview.hasResourceProperties('AWS::CloudFront::Function', {
      FunctionConfig: { Runtime: 'cloudfront-js-2.0' },
    });
  });

  it('inlines the router source into the function', () => {
    const [fn] = Object.values(preview.findResources('AWS::CloudFront::Function')) as any[];
    expect(fn.Properties.FunctionCode).toContain('pr-[0-9]+');
  });

  it('serves only the wildcard preview domain, with a matching DNS-validated certificate and alias', () => {
    preview.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: { Aliases: ['*.preview.friquelme.dev'] },
    });
    preview.hasResourceProperties('AWS::CertificateManager::Certificate', {
      DomainName: '*.preview.friquelme.dev',
      ValidationMethod: 'DNS',
    });
    preview.hasResourceProperties('AWS::Route53::RecordSet', {
      Name: '*.preview.friquelme.dev.',
      Type: 'A',
      HostedZoneId: 'TESTHOSTEDZONEID',
    });
  });

  it('exports the values the bootstrap script and workflows read', () => {
    for (const output of ['PreviewBucketName', 'PreviewDistributionId', 'PreviewDomain']) {
      expect(preview.toJSON().Outputs[output]).toBeDefined();
    }
    expect(preview.toJSON().Outputs.PreviewDomain.Value).toBe('preview.friquelme.dev');
  });
});
