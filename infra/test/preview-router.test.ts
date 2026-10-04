import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

// The function file has no exports (CloudFront runs it as is): evaluate it and take `handler`.
const source = readFileSync(resolve(__dirname, '../functions/preview-router.js'), 'utf8');
const handler = new Function(`${source}\nreturn handler;`)() as (event: unknown) => any;

function run(host: string | undefined, uri: string) {
  const headers = host === undefined ? {} : { host: { value: host } };
  return handler({ request: { uri, method: 'GET', headers, querystring: {} } });
}

describe('preview router', () => {
  it('maps the pull request host to its bucket prefix', () => {
    expect(run('pr-42.preview.friquelme.dev', '/_astro/app.js').uri).toBe('/pr-42/_astro/app.js');
  });

  it('serves the directory index for the root', () => {
    expect(run('pr-7.preview.friquelme.dev', '/').uri).toBe('/pr-7/index.html');
  });

  it('serves the directory index for a trailing-slash path', () => {
    expect(run('pr-7.preview.friquelme.dev', '/blog/').uri).toBe('/pr-7/blog/index.html');
    expect(run('pr-7.preview.friquelme.dev', '/blog/post/').uri).toBe('/pr-7/blog/post/index.html');
  });

  it('redirects a directory path without trailing slash like the production origin', () => {
    const response = run('pr-7.preview.friquelme.dev', '/blog');
    expect(response.statusCode).toBe(302);
    expect(response.headers.location.value).toBe('/blog/');
  });

  it('keeps files with an extension as files', () => {
    expect(run('pr-7.preview.friquelme.dev', '/sitemap-index.xml').uri).toBe('/pr-7/sitemap-index.xml');
    expect(run('pr-7.preview.friquelme.dev', '/blog/rss.xml').uri).toBe('/pr-7/blog/rss.xml');
  });

  it.each([
    ['suffixed with another domain', 'pr-1.preview.friquelme.dev.evil.com'],
    ['prefixed with another label', 'evil.pr-1.preview.friquelme.dev'],
    ['upper case', 'PR-1.preview.friquelme.dev'],
    ['without a number', 'pr-.preview.friquelme.dev'],
    ['with a non-numeric id', 'pr-1a.preview.friquelme.dev'],
    ['with a negative number', 'pr--1.preview.friquelme.dev'],
    ['the preview apex', 'preview.friquelme.dev'],
    ['production', 'friquelme.dev'],
    ['an unrelated label', 'main.preview.friquelme.dev'],
    ['with an unescaped dot (any character in place of a dot)', 'pr-1Xpreview.friquelme.dev'],
    ['with an unescaped dot before the domain', 'pr-1.previewXfriquelme.dev'],
    ['with an unescaped dot before the TLD', 'pr-1.preview.friquelmeXdev'],
    ['an empty host', ''],
  ])('answers 404 for a host %s', (_name, host) => {
    const response = run(host, '/');
    expect(response.statusCode).toBe(404);
    expect(response.uri).toBeUndefined();
  });

  it('answers 404 when the host header is missing', () => {
    expect(run(undefined, '/').statusCode).toBe(404);
  });
});
