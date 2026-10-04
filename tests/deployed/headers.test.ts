import { beforeAll, describe, expect, it } from 'vitest';
import { expectedSecurityHeaders, PREVIEW_ROBOTS_TAG } from '../../src/lib/security/headers';
import { deployedBaseUrl, isPreview, requireReachable, routes } from './target';

const base = deployedBaseUrl();

describe(`security headers on ${base.origin}`, () => {
  beforeAll(() => requireReachable(base));

  it('covers every built page', () => {
    expect(routes.length).toBeGreaterThanOrEqual(3);
    expect(routes).toContain('/');
  });

  it.each(routes)('%s answers 200 with the exact security headers', async route => {
    const response = await fetch(new URL(route, base), { redirect: 'manual' });
    await response.arrayBuffer();
    expect(response.status).toBe(200);
    const actual = Object.fromEntries(Object.keys(expectedSecurityHeaders).map(name => [name, response.headers.get(name)]));
    expect(actual).toEqual(expectedSecurityHeaders);
    expect(response.headers.get('x-robots-tag')).toBe(isPreview(base) ? PREVIEW_ROBOTS_TAG : null);
  });

  it('redirects a directory path without trailing slash to its slash form', async () => {
    const response = await fetch(new URL('/blog', base), { redirect: 'manual' });
    await response.arrayBuffer();
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/blog/');
  });
});
