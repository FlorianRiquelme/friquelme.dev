import { buildCsp } from './csp';

// Single definition of the response headers CloudFront adds to every page.
// The CDK stacks and the deployed-environment tests both import it, so what
// is deployed and what is asserted cannot drift apart.

export const HSTS_MAX_AGE_SECONDS = 63072000; // 2 years
export const HSTS_INCLUDE_SUBDOMAINS = true;
export const HSTS_PRELOAD = true;
export const FRAME_OPTION = 'DENY';
export const REFERRER_POLICY = 'strict-origin-when-cross-origin';
export const PERMISSIONS_POLICY =
  'camera=(), microphone=(), geolocation=(), interest-cohort=()';
export const PREVIEW_ROBOTS_TAG = 'noindex, nofollow';

export const CONTENT_SECURITY_POLICY = buildCsp({ posthog: 'eu' });

/** The Strict-Transport-Security value CloudFront renders from the flags above. */
export const STRICT_TRANSPORT_SECURITY =
  `max-age=${HSTS_MAX_AGE_SECONDS}` +
  (HSTS_INCLUDE_SUBDOMAINS ? '; includeSubDomains' : '') +
  (HSTS_PRELOAD ? '; preload' : '');

/** Exact header values every page response must carry, keyed by lower-case name. */
export const expectedSecurityHeaders: Readonly<Record<string, string>> = {
  'content-security-policy': CONTENT_SECURITY_POLICY,
  'strict-transport-security': STRICT_TRANSPORT_SECURITY,
  'x-content-type-options': 'nosniff',
  'x-frame-options': FRAME_OPTION,
  'referrer-policy': REFERRER_POLICY,
  'permissions-policy': PERMISSIONS_POLICY,
};
