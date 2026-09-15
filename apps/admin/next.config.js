const { withSentryConfig } = require('@sentry/nextjs/config');

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@orgname/notify'],
  // Next 14 needs this explicitly — it's default-on starting Next 15.
  experimental: {
    instrumentationHook: true,
  },
};

module.exports = withSentryConfig(nextConfig, {
  silent: true,
  // No SENTRY_AUTH_TOKEN configured — skip source map upload rather than
  // fail the build. Error stack traces will show minified code without it;
  // revisit if that ever gets in the way of debugging a real issue.
  sourcemaps: { disable: true },
  webpack: { treeshake: { removeDebugLogging: true } },
});
