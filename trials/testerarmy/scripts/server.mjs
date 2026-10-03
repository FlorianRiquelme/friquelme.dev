import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const host = '100.84.161.116';
const port = Number(process.env.TRIAL_PORT ?? 14375);
const variant = process.env.TRIAL_VARIANT ?? 'healthy';
const root = resolve(fileURLToPath(new URL('../../../dist/', import.meta.url)));
const pinnedLabel = 'aria-label="open pinned essay: designing for the operator"';
const pinnedHref = 'href="/blog/designing-for-the-operator/"';

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`TRIAL_PORT must be a valid TCP port, received ${process.env.TRIAL_PORT}`);
}
if (!['healthy', 'wrong-link', 'mobile-overlay'].includes(variant)) {
  throw new Error(`TRIAL_VARIANT must be healthy, wrong-link, or mobile-overlay; received ${variant}`);
}

const contentTypes = {
  '.avif': 'image/avif',
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
};

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { allow: 'GET, HEAD' }).end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, `http://${host}:${port}`).pathname);
  } catch {
    response.writeHead(400).end('Bad request');
    return;
  }

  const relativePath = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
  const filePath = resolve(root, `.${relativePath}`);
  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  let body;
  try {
    if (!(await stat(filePath)).isFile()) throw new Error('Not a file');
    body = await readFile(filePath);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
    return;
  }

  if (pathname === '/blog/' && variant === 'wrong-link') {
    let html = body.toString('utf8');
    const anchor = new RegExp(`${pinnedHref}(?=[^>]*${pinnedLabel})`, 'g');
    if (html.match(anchor)?.length !== 1) {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }).end('Pinned essay link fixture did not match exactly once');
      return;
    }
    html = html.replace(anchor, 'href="/blog/brownfield-ai/"');
    body = Buffer.from(html);
  }

  if (pathname === '/blog/' && variant === 'mobile-overlay') {
    const overlay = '<style>@media (max-width: 767px) { #trial-mobile-overlay { position: fixed; inset: 250px 0 auto; height: 400px; z-index: 2147483647; background: #000; } }</style><div id="trial-mobile-overlay" aria-hidden="true"></div>';
    body = Buffer.from(body.toString('utf8').replace('</body>', `${overlay}</body>`));
  }

  response.writeHead(200, {
    'cache-control': 'no-store',
    'content-length': body.length,
    'content-type': contentTypes[extname(filePath)] ?? 'application/octet-stream',
    'x-content-type-options': 'nosniff',
  });
  response.end(request.method === 'HEAD' ? undefined : body);
});

server.listen(port, host, () => {
  console.log(`Serving ${root} on http://${host}:${port} (${variant})`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
