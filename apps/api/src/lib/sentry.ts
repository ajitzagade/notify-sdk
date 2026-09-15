import * as Sentry from '@sentry/node';
import { scrubPii } from './sentryScrub';

// A missing DSN (e.g. local dev without SENTRY_DSN set) disables the SDK
// automatically — init/captureException become safe no-ops.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0,
  // Sentry only captures an Error's message/stack by default, not custom
  // properties (verified: axios's err.config/err.response, which would carry
  // the WhatsApp access token and message body, are NOT auto-serialized).
  // The real residual risk is a phone number landing in the message text
  // itself — e.g. a Postgres unique-constraint violation on (tenant_id,
  // contact_phone) embeds the actual value in its error detail. Scrub belt-
  // and-suspenders regardless of exact source.
  beforeSend: scrubPii,
});

export { Sentry };
