import * as Sentry from '@sentry/nextjs';
import { scrubPii } from './src/lib/sentryScrub';

// A missing DSN (e.g. local dev without SENTRY_DSN set) disables the SDK
// automatically — init/captureException become safe no-ops.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0,
  // See src/lib/sentryScrub.ts — strips anything that looks like a phone
  // number or bearer token before an event leaves the process.
  beforeSend: scrubPii,
});
