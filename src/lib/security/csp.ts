export type CspOptions = {
  posthog: 'eu' | false;
};

export function buildCsp(options: CspOptions): string {
  const posthogScript =
    options.posthog === 'eu' ? ' https://*.posthog.com' : '';
  const posthogConnect =
    options.posthog === 'eu' ? ' https://*.posthog.com' : '';

  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${posthogScript}`,
    `connect-src 'self'${posthogConnect}`,
    "img-src 'self' data: https:",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "worker-src 'self' blob: data:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ];

  return directives.join('; ');
}
