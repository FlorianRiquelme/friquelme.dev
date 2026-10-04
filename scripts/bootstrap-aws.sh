#!/usr/bin/env bash
# One-time (and re-runnable) setup for preview environments and GitHub-driven
# infrastructure deploys. Run it from a machine that has AWS administrator
# credentials and an authenticated `gh` (repo admin). It deploys the three CDK
# stacks, including PortfolioOidcStack, which CI never deploys.
set -euo pipefail

REPO="FlorianRiquelme/friquelme.dev"
REGION="us-east-1"
ENVIRONMENT="infrastructure"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PNPM=(node "$ROOT/scripts/pnpm.mjs")

step() { printf '\n==> %s\n' "$*"; }

stack_output() {
  aws cloudformation describe-stacks --region "$REGION" --stack-name "$1" \
    --query "Stacks[0].Outputs[?OutputKey=='$2'].OutputValue | [0]" --output text
}

step "Checking the checkout"
# The script deploys whatever is checked out, including the OIDC roles, so only run reviewed code.
if [ -n "$(git -C "$ROOT" status --porcelain)" ]; then
  echo "The working tree is not clean; commit or stash first." >&2
  exit 1
fi
git -C "$ROOT" fetch --quiet origin main
head_sha="$(git -C "$ROOT" rev-parse HEAD)"
main_sha="$(git -C "$ROOT" rev-parse origin/main)"
pr_sha="$(gh pr view 86 --repo "$REPO" --json headRefOid --jq .headRefOid 2>/dev/null || true)"
if [ "$head_sha" = "$main_sha" ]; then
  echo "HEAD is the latest origin/main ($head_sha)"
elif [ -n "$pr_sha" ] && [ "$head_sha" = "$pr_sha" ]; then
  echo "HEAD is the current head of PR 86 ($head_sha)"
else
  echo "HEAD $head_sha is neither the latest origin/main ($main_sha) nor the head of PR 86 (${pr_sha:-unknown}); refusing to deploy." >&2
  exit 1
fi

step "Checking AWS credentials"
account="$(aws sts get-caller-identity --query Account --output text)"
echo "AWS account: $account"

step "Checking GitHub authentication"
gh auth status

step "Installing dependencies"
"${PNPM[@]}" install --frozen-lockfile
"${PNPM[@]}" -C infra install --frozen-lockfile

step "Bootstrapping CDK for aws://$account/$REGION (idempotent)"
"${PNPM[@]}" -C infra cdk bootstrap "aws://$account/$REGION"

step "Deploying PortfolioSiteStack PortfolioPreviewStack PortfolioOidcStack"
"${PNPM[@]}" -C infra cdk deploy PortfolioSiteStack PortfolioPreviewStack PortfolioOidcStack \
  --require-approval never

step "Reading stack outputs"
preview_bucket="$(stack_output PortfolioPreviewStack PreviewBucketName)"
preview_role="$(stack_output PortfolioOidcStack PreviewDeployRoleArn)"
infra_role="$(stack_output PortfolioOidcStack InfraDeployRoleArn)"
for value in "$preview_bucket" "$preview_role" "$infra_role"; do
  if [ -z "$value" ] || [ "$value" = "None" ]; then
    echo "A stack output is missing; check the CloudFormation console." >&2
    exit 1
  fi
done
echo "Preview bucket: $preview_bucket"
echo "Preview role:   $preview_role"
echo "Infra role:     $infra_role"

step "Creating GitHub environment '$ENVIRONMENT' (deployments from main only)"
gh api -X PUT "repos/$REPO/environments/$ENVIRONMENT" \
  -F 'deployment_branch_policy[protected_branches]=false' \
  -F 'deployment_branch_policy[custom_branch_policies]=true' >/dev/null
existing_policies="$(gh api "repos/$REPO/environments/$ENVIRONMENT/deployment-branch-policies" \
  --jq '.branch_policies[].name')"
if grep -qx 'main' <<<"$existing_policies"; then
  echo "Branch policy 'main' already present"
else
  gh api -X POST "repos/$REPO/environments/$ENVIRONMENT/deployment-branch-policies" \
    -f name=main -f type=branch >/dev/null
  echo "Added branch policy 'main'"
fi
# Any other branch policy would let that branch assume the infra role.
while IFS= read -r name; do
  if [ -n "$name" ] && [ "$name" != "main" ]; then
    echo "Warning: environment also allows branch '$name'; remove it unless intended" >&2
  fi
done <<<"$existing_policies"

step "Restricting environment 'production' to main"
# Without a branch policy any branch's workflow can reach the production deploy role.
gh api -X PUT "repos/$REPO/environments/production" \
  -F 'deployment_branch_policy[protected_branches]=false' \
  -F 'deployment_branch_policy[custom_branch_policies]=true' >/dev/null
production_policies="$(gh api "repos/$REPO/environments/production/deployment-branch-policies" \
  --jq '.branch_policies[].name')"
if grep -qx 'main' <<<"$production_policies"; then
  echo "Branch policy 'main' already present"
else
  gh api -X POST "repos/$REPO/environments/production/deployment-branch-policies" \
    -f name=main -f type=branch >/dev/null
  echo "Added branch policy 'main'"
fi

step "Setting secrets and variable"
gh secret set AWS_PREVIEW_ROLE_ARN --repo "$REPO" --body "$preview_role"
gh secret set AWS_INFRA_ROLE_ARN --repo "$REPO" --env "$ENVIRONMENT" --body "$infra_role"
gh variable set PREVIEW_BUCKET_NAME --repo "$REPO" --body "$preview_bucket"

step "Done"
echo "Open a pull request to see its preview at https://pr-<number>.preview.friquelme.dev"
