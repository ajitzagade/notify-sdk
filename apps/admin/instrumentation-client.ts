import * as Sentry from '@sentry/nextjs';
import { scrubPii } from './src/lib/sentryScrub';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
  beforeSend: scrubPii,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
