import * as Sentry from '@sentry/node';

// A missing DSN (e.g. local dev without SENTRY_DSN set) disables the SDK
// automatically — init/captureException become safe no-ops.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0,
});

export { Sentry };
