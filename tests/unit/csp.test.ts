import { describe, it, expect } from 'vitest';
import { buildCsp } from '../../src/lib/security/csp';

describe('buildCsp', () => {
  describe('with PostHog EU', () => {
    const csp = buildCsp({ posthog: 'eu' });
    const directives = csp.split('; ');
    const directive = (name: string) =>
      directives.find((d) => d.startsWith(`${name} `)) ??
      directives.find((d) => d === name);

    it('allows PostHog in script-src', () => {
      expect(directive('script-src')).toContain('https://*.posthog.com');
    });

    it('allows PostHog in connect-src', () => {
      expect(directive('connect-src')).toContain('https://*.posthog.com');
    });

    it("includes 'unsafe-inline' in script-src for the PostHog bootstrap", () => {
      expect(directive('script-src')).toContain("'unsafe-inline'");
    });

    it('allows blob: and data: in worker-src for rrweb session-replay', () => {
      const workerSrc = directive('worker-src') ?? '';
      expect(workerSrc).toContain('blob:');
      expect(workerSrc).toContain('data:');
    });

    it("sets frame-ancestors to 'none' to block clickjacking", () => {
      expect(directive('frame-ancestors')).toBe("frame-ancestors 'none'");
    });

    it('joins directives with "; " (semicolon + space)', () => {
      expect(csp).toContain('; ');
      expect(csp).not.toContain(';;');
    });

    it('ends with upgrade-insecure-requests as the final directive', () => {
      expect(directives.at(-1)).toBe('upgrade-insecure-requests');
    });

    it("default-src is exactly \"'self'\"", () => {
      expect(directive('default-src')).toBe("default-src 'self'");
    });

    it("img-src allows data: and https: alongside 'self'", () => {
      expect(directive('img-src')).toBe("img-src 'self' data: https:");
    });

    it("style-src allows 'unsafe-inline' for Astro scoped styles + Tailwind 4", () => {
      expect(directive('style-src')).toBe(
        "style-src 'self' 'unsafe-inline'",
      );
    });

    it("font-src allows data: for inline base64 fonts", () => {
      expect(directive('font-src')).toBe("font-src 'self' data:");
    });

    it("base-uri is locked to 'self' to prevent injected <base>", () => {
      expect(directive('base-uri')).toBe("base-uri 'self'");
    });

    it("form-action is locked to 'self'", () => {
      expect(directive('form-action')).toBe("form-action 'self'");
    });

    it("object-src is 'none' to block <object>/<embed>/<applet>", () => {
      expect(directive('object-src')).toBe("object-src 'none'");
    });
  });

  describe('without PostHog', () => {
    const csp = buildCsp({ posthog: false });
    const directives = csp.split('; ');
    const directive = (name: string) =>
      directives.find((d) => d.startsWith(`${name} `)) ??
      directives.find((d) => d === name);

    it('omits PostHog from every directive', () => {
      expect(csp).not.toContain('posthog');
    });

    it("script-src is exactly \"'self' 'unsafe-inline'\"", () => {
      expect(directive('script-src')).toBe(
        "script-src 'self' 'unsafe-inline'",
      );
    });

    it("connect-src is exactly \"'self'\"", () => {
      expect(directive('connect-src')).toBe("connect-src 'self'");
    });
  });

  describe('variant invariants', () => {
    it('produces different strings for posthog enabled vs disabled', () => {
      expect(buildCsp({ posthog: 'eu' })).not.toBe(
        buildCsp({ posthog: false }),
      );
    });

    it('preserves non-PostHog directives identically across variants', () => {
      const eu = buildCsp({ posthog: 'eu' }).split('; ');
      const off = buildCsp({ posthog: false }).split('; ');

      const stableDirectives = [
        'default-src',
        'img-src',
        'style-src',
        'font-src',
        'worker-src',
        'frame-ancestors',
        'base-uri',
        'form-action',
        'object-src',
      ];

      for (const name of stableDirectives) {
        const fromEu = eu.find((d) => d.startsWith(`${name} `));
        const fromOff = off.find((d) => d.startsWith(`${name} `));
        expect(fromOff).toBe(fromEu);
      }
    });
  });
});
