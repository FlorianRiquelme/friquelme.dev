import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';
import { securityHeadersPolicyProps } from './security-headers';
import { DOMAIN_NAME } from './static-site-stack';

export const PREVIEW_DOMAIN = `preview.${DOMAIN_NAME}`;
const PREVIEW_WILDCARD = `*.${PREVIEW_DOMAIN}`;

/**
 * One bucket and one distribution for every pull request preview:
 * pr-<N>.preview.friquelme.dev serves the objects under pr-<N>/.
 */
export class PreviewStack extends cdk.Stack {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Private bucket, reachable only through CloudFront (origin access control).
    // The lifecycle rule is a backstop for previews whose cleanup run failed.
    this.bucket = new s3.Bucket(this, 'PreviewBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      lifecycleRules: [{ expiration: cdk.Duration.days(14) }],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: DOMAIN_NAME,
    });

    const certificate = new acm.Certificate(this, 'PreviewCertificate', {
      domainName: PREVIEW_WILDCARD,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(
      this,
      'PreviewSecurityHeaders',
      securityHeadersPolicyProps({ noindex: true }),
    );

    const router = new cloudfront.Function(this, 'PreviewRouter', {
      code: cloudfront.FunctionCode.fromFile({
        filePath: path.join(__dirname, '..', 'functions', 'preview-router.js'),
      }),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
    });

    this.distribution = new cloudfront.Distribution(this, 'PreviewDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        // Previews change on every push; no caching means no invalidations.
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        responseHeadersPolicy,
        functionAssociations: [
          {
            function: router,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },
      domainNames: [PREVIEW_WILDCARD],
      certificate,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    new route53.ARecord(this, 'PreviewAliasRecord', {
      zone: hostedZone,
      recordName: PREVIEW_WILDCARD,
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(this.distribution),
      ),
    });

    new cdk.CfnOutput(this, 'PreviewBucketName', {
      value: this.bucket.bucketName,
    });

    new cdk.CfnOutput(this, 'PreviewDistributionId', {
      value: this.distribution.distributionId,
    });

    new cdk.CfnOutput(this, 'PreviewDomain', {
      value: PREVIEW_DOMAIN,
    });
  }
}
