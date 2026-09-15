'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

// Catches errors thrown by the root layout itself — error.tsx only catches
// errors in its children, so a crash in layout.tsx would otherwise be
// invisible to both the user and Sentry. Must render its own <html>/<body>
// since it replaces the root layout when it fires.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error('[admin] Root layout crashed', error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '2rem', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
          <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>Something went wrong</p>
          <p style={{ fontSize: '0.875rem', color: '#71717a' }}>Please refresh the page. If this keeps happening, contact support.</p>
        </div>
      </body>
    </html>
  );
}
