'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/lib/toast';

// Meta's Embedded Signup: FB.login opens a Meta-hosted popup that creates the
// business's WABA + phone number, then (a) posts a WA_EMBEDDED_SIGNUP message
// with the new ids to this window and (b) resolves the login callback with a
// one-shot OAuth code. Both halves are needed — the code alone doesn't tell
// us which WABA was created. The code expires in ~30s, so we finalize
// immediately server-side.

declare global {
  interface Window {
    FB?: {
      init(opts: { appId: string; autoLogAppEvents: boolean; xfbml: boolean; version: string }): void;
      login(
        cb: (response: { authResponse?: { code?: string } | null }) => void,
        opts: Record<string, unknown>
      ): void;
    };
    fbAsyncInit?: () => void;
  }
}

const SDK_URL = 'https://connect.facebook.net/en_US/sdk.js';
const GRAPH_VERSION = 'v20.0';

export function EmbeddedSignupButton({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const configId = process.env.NEXT_PUBLIC_META_ES_CONFIG_ID;

  const [sdkReady, setSdkReady] = useState(false);
  const [connecting, setConnecting] = useState(false);
  // Posted by the popup before the login callback fires; kept in a ref because
  // the callback closure must always see the latest value.
  const signupInfo = useRef<{ wabaId?: string; phoneNumberId?: string }>({});

  useEffect(() => {
    if (!appId) return;

    // TEMPORARY diagnostic (remove once the real cause is confirmed): log
    // every single postMessage this window receives, unconditionally, before
    // any filtering — the previous version filtered by origin/type first and
    // could silently swallow the very message we need to see.
    const onMessage = (event: MessageEvent) => {
      // eslint-disable-next-line no-console
      console.log('[EmbeddedSignup] raw message event:', { origin: event.origin, data: event.data });

      let origin: string;
      try {
        origin = new URL(event.origin).hostname;
      } catch (err) {
        console.log('[EmbeddedSignup] event.origin failed to parse as a URL:', event.origin, err);
        return;
      }
      // Meta hosts the Embedded Signup popup on various *.facebook.com
      // subdomains (www., web., business., m., …) — a strict equality check
      // against just two of them silently drops the message on any other
      // subdomain, which looks exactly like "Meta never sent it."
      if (origin !== 'facebook.com' && !origin.endsWith('.facebook.com')) {
        console.log('[EmbeddedSignup] ignoring message from non-facebook origin:', origin);
        return;
      }

      let data: unknown;
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch (err) {
        console.log('[EmbeddedSignup] message from facebook.com was not JSON:', event.data, err);
        return;
      }
      console.log('[EmbeddedSignup] parsed facebook.com message:', data);

      const parsed = data as { type?: string; event?: string; data?: { waba_id?: string; phone_number_id?: string } };
      if (parsed?.type === 'WA_EMBEDDED_SIGNUP' && parsed?.data?.waba_id) {
        signupInfo.current = {
          wabaId:        String(parsed.data.waba_id),
          phoneNumberId: parsed.data.phone_number_id ? String(parsed.data.phone_number_id) : undefined,
        };
        console.log('[EmbeddedSignup] captured wabaId/phoneNumberId:', signupInfo.current);
      }
    };
    window.addEventListener('message', onMessage);

    if (window.FB) {
      setSdkReady(true);
    } else {
      window.fbAsyncInit = () => {
        window.FB?.init({ appId, autoLogAppEvents: true, xfbml: false, version: GRAPH_VERSION });
        setSdkReady(true);
      };
      if (!document.querySelector(`script[src="${SDK_URL}"]`)) {
        const script = document.createElement('script');
        script.src = SDK_URL;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
    }

    return () => window.removeEventListener('message', onMessage);
  }, [appId]);

  const finalize = useCallback(async (code: string) => {
    // The WA_EMBEDDED_SIGNUP message usually lands before the login callback,
    // but not guaranteed — poll briefly rather than racing it.
    for (let i = 0; i < 20 && !signupInfo.current.wabaId; i++) {
      await new Promise((r) => setTimeout(r, 250));
    }
    const { wabaId, phoneNumberId } = signupInfo.current;
    if (!wabaId || !phoneNumberId) {
      throw new Error('Signup finished but Meta did not report the new account ids — please try again');
    }
    const res = await fetch(`/api/tenants/${tenantId}/embedded-signup`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ code, wabaId, phoneNumberId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Connection failed');
    toast.success(
      `WhatsApp connected${data.verifiedName ? ` — “${data.verifiedName}”` : ''}${data.displayPhoneNumber ? ` (${data.displayPhoneNumber})` : ''}`
    );
    router.refresh();
  }, [tenantId, router]);

  const launch = () => {
    if (!window.FB || !configId) return;
    setConnecting(true);
    signupInfo.current = {};
    window.FB.login(
      (response) => {
        const code = response.authResponse?.code;
        if (!code) {
          setConnecting(false);
          toast.error('Signup was cancelled before completing');
          return;
        }
        finalize(code)
          .catch((err) => toast.error(err instanceof Error ? err.message : String(err)))
          .finally(() => setConnecting(false));
      },
      {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: { setup: {}, sessionInfoVersion: '3' },
      }
    );
  };

  return (
    <Button type="button" onClick={launch} disabled={!sdkReady || connecting}>
      {connecting && <Loader2 className="animate-spin" />}
      {connecting ? 'Connecting…' : 'Continue with Facebook'}
    </Button>
  );
}
