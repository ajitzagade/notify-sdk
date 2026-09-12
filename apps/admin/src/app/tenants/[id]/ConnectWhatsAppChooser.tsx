'use client';

import { useState, type ReactNode } from 'react';
import { ArrowLeft, KeyRound } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmbeddedSignupButton } from './EmbeddedSignupButton';

// Inlined at build time; when both are set (post-App-Review), the Facebook
// door goes live with no code change — see docs/phase2-launch-checklist.md.
const EMBEDDED_SIGNUP_ENABLED = Boolean(
  process.env.NEXT_PUBLIC_META_APP_ID && process.env.NEXT_PUBLIC_META_ES_CONFIG_ID
);

/**
 * The two-door entry to the Credentials setup step (Phase 1 of
 * docs/whatsapp-platform-roadmap.md). The Embedded Signup door is a disabled
 * preview until Phase 2 ships; the manual door reveals the existing
 * CredentialsForm passed as children. Once credentials are configured the
 * chooser steps aside entirely — both onboarding paths are permanent peers,
 * so nothing here is a migration state.
 */
export function ConnectWhatsAppChooser({
  tenantId, configured, children,
}: { tenantId: string; configured: boolean; children: ReactNode }) {
  const [showManual, setShowManual] = useState(configured);

  if (showManual) {
    return (
      <div className="grid gap-3">
        {!configured && (
          <button
            type="button"
            onClick={() => setShowManual(false)}
            className="flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Other connection options
          </button>
        )}
        {children}
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="relative border-primary-2/40">
        <CardContent className="flex h-full flex-col gap-3 pt-6">
          {!EMBEDDED_SIGNUP_ENABLED && (
            <Badge variant="secondary" className="absolute right-4 top-4">Coming soon</Badge>
          )}
          <div className="flex size-10 items-center justify-center rounded-lg bg-[oklch(0.51_0.19_262)]/12">
            {/* lucide no longer ships brand icons — Meta's "f" mark, minimal path */}
            <svg viewBox="0 0 24 24" className="size-5 fill-[oklch(0.51_0.19_262)]" aria-hidden>
              <path d="M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.5 1.6-1.5h1.3V4.9c-.2 0-1-.1-1.9-.1-1.9 0-3.2 1.2-3.2 3.3V11H8.5v3h2.8v7h2.2Z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold">Continue with Facebook</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              No Meta developer account needed — log in with Facebook, confirm the business name and
              phone number, and everything is set up automatically. Nothing to copy or paste.
            </p>
          </div>
          <div className="mt-auto">
            {EMBEDDED_SIGNUP_ENABLED ? (
              <EmbeddedSignupButton tenantId={tenantId} />
            ) : (
              <Button type="button" disabled>Continue with Facebook</Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex h-full flex-col gap-3 pt-6">
          <div className="flex size-10 items-center justify-center rounded-lg bg-accent">
            <KeyRound className="size-5 text-accent-foreground" />
          </div>
          <div>
            <h3 className="text-base font-semibold">I already have WhatsApp API credentials</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              The business already has a Meta app and WhatsApp Business Account. Paste the Phone
              Number ID, access token, and app secret — they're verified live against Meta before saving.
            </p>
          </div>
          <div className="mt-auto">
            <Button type="button" variant="outline" onClick={() => setShowManual(true)}>
              Enter credentials manually
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
