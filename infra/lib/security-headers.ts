import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import {
  CONTENT_SECURITY_POLICY,
  FRAME_OPTION,
  HSTS_INCLUDE_SUBDOMAINS,
  HSTS_MAX_AGE_SECONDS,
  HSTS_PRELOAD,
  PERMISSIONS_POLICY,
  PREVIEW_ROBOTS_TAG,
  REFERRER_POLICY,
} from '../../src/lib/security/headers';

/**
 * Props of the security headers policy. Production and previews both build
 * their policy from this function, so previews serve the production headers by
 * construction. Previews only add `X-Robots-Tag`.
 */
export function securityHeadersPolicyProps(
  options: { noindex?: boolean } = {},
): cloudfront.ResponseHeadersPolicyProps {
  return {
    securityHeadersBehavior: {
      strictTransportSecurity: {
        accessControlMaxAge: cdk.Duration.seconds(HSTS_MAX_AGE_SECONDS),
        includeSubdomains: HSTS_INCLUDE_SUBDOMAINS,
        preload: HSTS_PRELOAD,
        override: true,
      },
      contentTypeOptions: { override: true },
      frameOptions: {
        frameOption: cloudfront.HeadersFrameOption[FRAME_OPTION],
        override: true,
      },
      referrerPolicy: {
        // The enum values are the header values, so the shared string maps directly.
        referrerPolicy: REFERRER_POLICY as cloudfront.HeadersReferrerPolicy,
        override: true,
      },
      contentSecurityPolicy: {
        contentSecurityPolicy: CONTENT_SECURITY_POLICY,
        override: true,
      },
    },
    customHeadersBehavior: {
      customHeaders: [
        {
          header: 'Permissions-Policy',
          value: PERMISSIONS_POLICY,
          override: true,
        },
        ...(options.noindex
          ? [{ header: 'X-Robots-Tag', value: PREVIEW_ROBOTS_TAG, override: true }]
          : []),
      ],
    },
  };
}
