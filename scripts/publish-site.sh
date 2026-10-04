#!/usr/bin/env bash
# Usage: publish-site.sh <dist-dir> <invalidation paths...>
# Env: S3_BUCKET_NAME, CLOUDFRONT_DISTRIBUTION_ID
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "usage: publish-site.sh <dist-dir> <invalidation paths...>" >&2
  exit 2
fi
dist="${1%/}"
shift

# Sync hashed assets with immutable cache headers
aws s3 sync "$dist/_astro/" "s3://${S3_BUCKET_NAME}/_astro/" \
  --cache-control "public,max-age=31536000,immutable" \
  --delete

# Sync root files with must-revalidate cache headers
aws s3 sync "$dist/" "s3://${S3_BUCKET_NAME}/" \
  --exclude "_astro/*" \
  --cache-control "public,max-age=0,must-revalidate" \
  --delete

aws cloudfront create-invalidation \
  --distribution-id "${CLOUDFRONT_DISTRIBUTION_ID}" \
  --paths "$@"
