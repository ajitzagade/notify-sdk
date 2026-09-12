# Phase 2 launch checklist — flipping Embedded Signup live

The Embedded Signup code shipped dormant (see `apps/admin/src/lib/embeddedSignup.ts`,
`EmbeddedSignupButton.tsx`, `/api/tenants/[id]/embedded-signup`). Nothing about it runs until
the environment variables below are set — this doc is the exact sequence for launch day, once
Meta approves the app.

## Prerequisites (Meta console — human tasks, do these first, they gate everything)

1. **Business verification** for the platform's own business portfolio (Azentis) — Meta
   Business Suite → Settings → Business verification.
2. **Facebook Login for Business** product added and configured on the Meta app.
3. **App Review** approved for `whatsapp_business_management` and
   `whatsapp_business_messaging` (Advanced Access). Needs screen recordings of sending a
   message and creating a template — the Test Send tab and the starter template gallery are
   exactly the flows to record.
4. **App published** (Live mode, not Development).

## Meta console — configuration objects (after approval)

5. Create an **Embedded Signup configuration**: Meta app → Facebook Login for Business →
   Configurations → Create → type "WhatsApp Embedded Signup". Note the **Configuration ID**.
6. Add the admin app's domain to the app's **Allowed Domains for the JavaScript SDK**
   (Facebook Login for Business → Settings) and set a valid OAuth redirect if prompted.
   `localhost` works for development testing.
7. Configure the **webhook callback** on the platform app's WhatsApp product: URL =
   `https://<api host>/v1/webhook/whatsapp`, subscribe to `messages`. The verify challenge
   uses the per-tenant `verify_token` — for the platform app use any fixed token accepted by
   the existing webhook GET handler config in apps/api.

## This repo — activation (no code changes)

8. Set in `apps/admin/.env.local` (and production env):
   ```
   META_APP_ID=<app id>
   META_APP_SECRET=<app secret>            # server-side only
   NEXT_PUBLIC_META_APP_ID=<same app id>   # inlined into the client bundle
   NEXT_PUBLIC_META_ES_CONFIG_ID=<configuration id from step 5>
   ```
9. Rebuild/restart `apps/admin` (NEXT_PUBLIC_* vars are baked in at build time).
10. The Credentials step's "Continue with Facebook" door is now live (the "Coming soon"
    badge disappears automatically).

## First live test

11. Create a throwaway tenant, open Setup → Credentials → Continue with Facebook, and run a
    real signup with a spare phone number (must not be on personal WhatsApp).
12. Confirm: `tenant_wa_credentials` row has `onboarding_method = 'embedded_signup'`; Test
    Send works; an inbound reply reaches the Inbox (proves the webhook subscription from
    `subscribeAppToWaba` took).
13. Submit one starter template from the gallery and confirm it appears in the tenant's
    WhatsApp Manager under the new WABA.

## Known limits / follow-ups

- The OAuth **code expires in ~30 seconds**; `EmbeddedSignupButton` finalizes immediately, but
  a slow admin-server cold start could still lose one — retrying the flow is safe (upsert).
- Onboarding throughput before full approval: **10 new clients / rolling 7 days**; rises to
  200 automatically once business verification + App Review + access verification are done.
- Embedded-Signup tenants' webhook signatures verify against the **platform** app secret
  (stored per-tenant at signup) — rotating META_APP_SECRET means re-encrypting those tenants'
  `app_secret_*` columns; the manual-path tenants are unaffected.
