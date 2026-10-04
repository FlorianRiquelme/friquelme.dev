import { describe, it, expect, beforeAll } from 'vitest';
import { Template } from 'aws-cdk-lib/assertions';
import { synthAll, TEST_ACCOUNT } from './app';

const SUB = 'token.actions.githubusercontent.com:sub';
const AUD = 'token.actions.githubusercontent.com:aud';

describe('GitHubOidcStack', () => {
  let oidc: Template;

  beforeAll(() => {
    ({ oidc } = synthAll());
  });

  const role = (logicalPrefix: string) => {
    const roles = Object.entries(oidc.findResources('AWS::IAM::Role')).filter(([id]) => id.startsWith(logicalPrefix));
    expect(roles).toHaveLength(1);
    return roles[0] as [string, any];
  };

  const policyFor = (roleId: string) => {
    const policies = Object.values(oidc.findResources('AWS::IAM::Policy')).filter((policy: any) =>
      policy.Properties.Roles.some((ref: any) => ref.Ref === roleId),
    ) as any[];
    expect(policies).toHaveLength(1);
    return policies[0].Properties.PolicyDocument.Statement;
  };

  it('creates exactly the production, preview and infra roles', () => {
    const federated = Object.values(oidc.findResources('AWS::IAM::Role')).filter((resource: any) =>
      resource.Properties.AssumeRolePolicyDocument.Statement.some(
        (statement: any) => statement.Action === 'sts:AssumeRoleWithWebIdentity',
      ),
    );
    expect(federated).toHaveLength(3);
  });

  describe('preview deploy role', () => {
    it('is assumable only by pull_request tokens of this repository for sts.amazonaws.com', () => {
      const [, { Properties }] = role('PreviewDeployRole');
      expect(Properties.RoleName).toBe('friquelme-preview-deploy');
      expect(Properties.AssumeRolePolicyDocument.Statement).toHaveLength(1);
      const [statement] = Properties.AssumeRolePolicyDocument.Statement;
      expect(statement.Action).toBe('sts:AssumeRoleWithWebIdentity');
      expect(statement.Condition).toEqual({
        StringEquals: {
          [AUD]: 'sts.amazonaws.com',
          [SUB]: 'repo:FlorianRiquelme/friquelme.dev:pull_request',
        },
      });
    });

    it('may touch only the preview bucket', () => {
      const [id] = role('PreviewDeployRole');
      const statements = policyFor(id);
      expect(statements).toHaveLength(1);
      expect(statements[0].Effect).toBe('Allow');
      expect(statements[0].Action).toEqual(['s3:PutObject', 's3:DeleteObject', 's3:GetObject', 's3:ListBucket']);
      const serialized = JSON.stringify(statements[0].Resource);
      expect(serialized).toContain('TestPreview:ExportsOutputFnGetAttPreviewBucket');
      expect(serialized).not.toContain('SiteBucket');
      expect(statements[0].Resource).toHaveLength(2);
    });
  });

  describe('infra deploy role', () => {
    it('is assumable only from the infrastructure environment of this repository', () => {
      const [, { Properties }] = role('InfraDeployRole');
      expect(Properties.RoleName).toBe('friquelme-infra-deploy');
      expect(Properties.AssumeRolePolicyDocument.Statement).toHaveLength(1);
      const [statement] = Properties.AssumeRolePolicyDocument.Statement;
      expect(statement.Action).toBe('sts:AssumeRoleWithWebIdentity');
      expect(statement.Condition).toEqual({
        StringEquals: {
          [AUD]: 'sts.amazonaws.com',
          [SUB]: 'repo:FlorianRiquelme/friquelme.dev:environment:infrastructure',
        },
      });
    });

    it('may only assume the CDK bootstrap roles', () => {
      const [id] = role('InfraDeployRole');
      expect(policyFor(id)).toEqual([
        {
          Action: 'sts:AssumeRole',
          Effect: 'Allow',
          Resource: `arn:aws:iam::${TEST_ACCOUNT}:role/cdk-hnb659fds-*-${TEST_ACCOUNT}-us-east-1`,
        },
      ]);
    });
  });

  describe('production deploy role', () => {
    it('stays locked to the production environment with bucket and invalidation permissions', () => {
      const [id, { Properties }] = role('GitHubDeployRole');
      expect(Properties.RoleName).toBeUndefined();
      expect(Properties.AssumeRolePolicyDocument.Statement[0].Condition).toEqual({
        StringEquals: { [AUD]: 'sts.amazonaws.com' },
        StringLike: { [SUB]: 'repo:FlorianRiquelme/friquelme.dev:environment:production' },
      });
      const statements = policyFor(id);
      expect(statements.map((statement: any) => statement.Action)).toEqual([
        ['s3:PutObject', 's3:DeleteObject', 's3:GetObject', 's3:ListBucket'],
        'cloudfront:CreateInvalidation',
      ]);
      expect(JSON.stringify(statements[0].Resource)).not.toContain('TestPreview');
    });
  });

  it('outputs the three role ARNs', () => {
    const outputs = oidc.toJSON().Outputs;
    for (const name of ['DeployRoleArn', 'PreviewDeployRoleArn', 'InfraDeployRoleArn']) {
      expect(outputs[name]).toBeDefined();
    }
  });
});
