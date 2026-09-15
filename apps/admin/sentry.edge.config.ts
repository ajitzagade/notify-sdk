import * as Sentry from '@sentry/nextjs';
import { scrubPii } from './src/lib/sentryScrub';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0,
  beforeSend: scrubPii,
});
