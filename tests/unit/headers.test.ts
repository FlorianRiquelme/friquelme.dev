import { describe, it, expect } from 'vitest';
import { buildCsp } from '../../src/lib/security/csp';
import {
  CONTENT_SECURITY_POLICY,
  expectedSecurityHeaders,
  PREVIEW_ROBOTS_TAG,
  STRICT_TRANSPORT_SECURITY,
} from '../../src/lib/security/headers';

describe('shared security headers', () => {
  it('renders HSTS the way CloudFront emits it', () => {
    expect(STRICT_TRANSPORT_SECURITY).toBe('max-age=63072000; includeSubDomains; preload');
  });

  it('keeps previews out of search indexes', () => {
    expect(PREVIEW_ROBOTS_TAG).toBe('noindex, nofollow');
  });

  it('uses the production CSP', () => {
    expect(CONTENT_SECURITY_POLICY).toBe(buildCsp({ posthog: 'eu' }));
  });

  it('lists exactly the six headers the deployed suite compares', () => {
    expect(expectedSecurityHeaders).toEqual({
      'content-security-policy': buildCsp({ posthog: 'eu' }),
      'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'strict-origin-when-cross-origin',
      'permissions-policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
    });
  });
});
