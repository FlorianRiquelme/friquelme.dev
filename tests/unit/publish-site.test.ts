import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ASSET_CACHE_CONTROL, HTML_CACHE_CONTROL } from '../../scripts/smoke-production.mjs';

const dir = mkdtempSync(join(tmpdir(), 'publish-site-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('publish-site.sh', () => {
  it('uses the production cache-control values', () => {
    expect(HTML_CACHE_CONTROL).toBe('public,max-age=0,must-revalidate');
    expect(ASSET_CACHE_CONTROL).toBe('public,max-age=31536000,immutable');
  });


  it('syncs assets as immutable, the rest as must-revalidate, then invalidates', () => {
    const bin = join(dir, 'bin');
    const log = join(dir, 'aws.log');
    mkdirSync(bin);
    writeFileSync(join(bin, 'aws'), `#!/usr/bin/env bash\necho "$*" >> "${log}"\n`);
    chmodSync(join(bin, 'aws'), 0o755);
    const result = spawnSync('bash', ['scripts/publish-site.sh', 'out/', '/', '/blog/*'], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, S3_BUCKET_NAME: 'bucket', CLOUDFRONT_DISTRIBUTION_ID: 'DIST' },
    });
    expect(result.status).toBe(0);
    expect(readFileSync(log, 'utf8').trimEnd().split('\n')).toEqual([
      `s3 sync out/_astro/ s3://bucket/_astro/ --cache-control ${ASSET_CACHE_CONTROL} --delete`,
      `s3 sync out/ s3://bucket/ --exclude _astro/* --cache-control ${HTML_CACHE_CONTROL} --delete`,
      'cloudfront create-invalidation --distribution-id DIST --paths / /blog/*',
    ]);
  });
});
