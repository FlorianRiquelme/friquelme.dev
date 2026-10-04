import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';

interface GitHubOidcStackProps extends cdk.StackProps {
  bucket: s3.IBucket;
  previewBucket: s3.IBucket;
  distribution: cloudfront.IDistribution;
}

const GITHUB_REPO = 'FlorianRiquelme/friquelme.dev';
// Default CDK bootstrap qualifier
const CDK_QUALIFIER = 'hnb659fds';

export class GitHubOidcStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: GitHubOidcStackProps) {
    super(scope, id, props);

    const { bucket, previewBucket, distribution } = props;

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
          'token.actions.githubusercontent.com:sub': `repo:${GITHUB_REPO}:environment:production`,
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

    // Preview role — assumed by pull_request workflows to publish previews.
    // It can write the preview bucket and nothing else.
    const previewDeployRole = new iam.Role(this, 'PreviewDeployRole', {
      roleName: 'friquelme-preview-deploy',
      assumedBy: new iam.OpenIdConnectPrincipal(oidcProvider, {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          'token.actions.githubusercontent.com:sub': `repo:${GITHUB_REPO}:pull_request`,
        },
      }),
      description: 'Role assumed by GitHub Actions to publish pull request previews',
      maxSessionDuration: cdk.Duration.hours(1),
    });

    previewDeployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          's3:PutObject',
          's3:DeleteObject',
          's3:GetObject',
          's3:ListBucket',
        ],
        resources: [previewBucket.bucketArn, `${previewBucket.bucketArn}/*`],
      }),
    );

    new cdk.CfnOutput(this, 'PreviewDeployRoleArn', {
      value: previewDeployRole.roleArn,
    });

    // Infra role — assumed by the infra-deploy workflow (environment
    // "infrastructure", main only). It may only assume the CDK bootstrap roles;
    // CloudFormation's execution role does the actual work.
    const infraDeployRole = new iam.Role(this, 'InfraDeployRole', {
      roleName: 'friquelme-infra-deploy',
      assumedBy: new iam.OpenIdConnectPrincipal(oidcProvider, {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          'token.actions.githubusercontent.com:sub': `repo:${GITHUB_REPO}:environment:infrastructure`,
        },
      }),
      description: 'Role assumed by GitHub Actions to deploy infrastructure through the CDK bootstrap roles',
      maxSessionDuration: cdk.Duration.hours(1),
    });

    infraDeployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['sts:AssumeRole'],
        resources: [
          `arn:aws:iam::${this.account}:role/cdk-${CDK_QUALIFIER}-*-${this.account}-${this.region}`,
        ],
      }),
    );

    new cdk.CfnOutput(this, 'InfraDeployRoleArn', {
      value: infraDeployRole.roleArn,
    });
  }
}
