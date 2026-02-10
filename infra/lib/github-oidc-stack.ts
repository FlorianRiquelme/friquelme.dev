import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';

interface GitHubOidcStackProps extends cdk.StackProps {
  bucket: s3.IBucket;
  distribution: cloudfront.IDistribution;
}

const GITHUB_REPO = 'FlorianRiquelme/portfolio';

export class GitHubOidcStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: GitHubOidcStackProps) {
    super(scope, id, props);

    const { bucket, distribution } = props;

    // GitHub OIDC provider
    const oidcProvider = new iam.OpenIdConnectProvider(
      this,
      'GitHubOidcProvider',
      {
        url: 'https://token.actions.githubusercontent.com',
        clientIds: ['sts.amazonaws.com'],
      },
    );

    // Deploy role — trust policy locked to main branch
    const deployRole = new iam.Role(this, 'GitHubDeployRole', {
      assumedBy: new iam.OpenIdConnectPrincipal(oidcProvider, {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
        },
        StringLike: {
          'token.actions.githubusercontent.com:sub': `repo:${GITHUB_REPO}:ref:refs/heads/main`,
        },
      }),
      description: 'Role assumed by GitHub Actions to deploy the portfolio site',
      maxSessionDuration: cdk.Duration.hours(1),
    });

    // S3 permissions — minimal
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          's3:PutObject',
          's3:DeleteObject',
          's3:GetObject',
          's3:ListBucket',
        ],
        resources: [bucket.bucketArn, `${bucket.bucketArn}/*`],
      }),
    );

    // CloudFront invalidation
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['cloudfront:CreateInvalidation'],
        resources: [
          `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`,
        ],
      }),
    );

    new cdk.CfnOutput(this, 'DeployRoleArn', {
      value: deployRole.roleArn,
    });
  }
}
