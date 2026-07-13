# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A multi-tenant WhatsApp Business Platform SaaS. `packages/notify` is a WhatsApp Cloud API SDK; the rest of the monorepo turns it into a platform where an internal ops team (`apps/admin`) onboards client businesses, each with fully isolated credentials, branding, contacts, templates, and message history, and exposes a tenant-facing REST API (`apps/api`'s `/v1/*` routes) for those businesses' own backends to send messages. See `README.md` for the full scenario/use-case list and `packages/notify/README.md` for the SDK's API reference.

pnpm workspace + Turborepo monorepo: `packages/notify` (SDK), `apps/admin` (Next.js ops panel), `apps/api` (Express — single-tenant demo + multi-tenant API), `apps/web` (Next.js — untouched single-tenant SDK usage reference).

## Real-world use cases and where they live

- **OTP/verification codes, task assignments, approvals, deploy alerts, generic alerts with buttons** — session messages (within Meta's 24h customer-service window) built by `TemplateEngine`'s built-in registry (`packages/notify/src/core/TemplateEngine.ts`) or a custom `notify.registerTemplate(name, builder)`. Sent via `NotifyClient.send()`.
- **Order shipped/marketing broadcasts to a whole audience, reachable even outside the 24h window** — real Meta-approved (HSM) templates. A tenant's approved list is pulled via `NotifyClient.syncTemplates()` (needs `wabaId`) and stored in `wa_templates`; a send passes `SendOptions.hsmTemplate` instead of `template`. `apps/admin`'s Templates tab (sync) and Campaigns page (parameterized send against a persisted `broadcast_list`) are the UI for this end-to-end flow.
- **Invoices, receipts, product photos, voice notes** — `SendOptions.attachment` (`image`/`video`/`document`/`audio`, a public HTTPS `link` — Meta fetches it, no pre-upload needed). `apps/admin`'s per-tenant media library (`media_assets` table, Vercel Blob-backed) is where these links come from in practice.
- **Customer replies, button taps (Approve/Reject, Mark done, etc.), STOP/START consent management** — inbound webhooks. Single-tenant: `WebhookHandler`. Multi-tenant (the real path): `TenantWebhookRouter` resolves the tenant from the payload's `phone_number_id`, verifies against that tenant's own `appSecret`, then dispatches — see the "tenant identity is bound at adapter-construction time" note below for why there's no `tenantId` parameter anywhere in this call chain. Every reply is persisted to `message_replies` (not just event-emitted) so it's queryable later.
- **Onboarding a new client business end-to-end** — `apps/admin`: create tenant → upload logo/set brand color → enter WhatsApp credentials (live-verified against Meta's Graph API before the save is even allowed to persist) → sync templates → send a real test message, all without touching code or redeploying anything.
- **A client's own backend sending messages programmatically without ever seeing Meta credentials** — `apps/api`'s `/v1/send` etc., authenticated by an API key ops issued them in `apps/admin`'s API Keys tab. This is the integration point for literally any external system, not just Node.
- **"Why did tenant X's credentials change last week?"** — `admin_audit_log`, written on every credential/branding/API-key mutation in `apps/admin`, attributed to the acting admin user.
- **"How many people did we actually reach, and did anyone respond?"** — the Analytics tab (`apps/admin`'s default tab on a tenant page): live sent/delivered/read/failed/reply rollups and per-campaign performance, computed on every request from `notify_log`/`message_replies`, never a cached snapshot. See `lib/analytics.ts`.

## Commands

```bash
pnpm install                              # from repo root, installs everything
docker compose up -d                      # Postgres on localhost:5434 (user/pass/db: notify/notify/notify_sdk)

# Apply migrations (idempotent, run in order against a fresh DB)
for f in packages/notify/src/adapters/storage/migrations/*.sql; do
  PGPASSWORD=notify psql -h localhost -p 5434 -U notify -d notify_sdk -f "$f"
done

pnpm --filter @orgname/notify build        # must run before apps/admin or apps/api's /v1 routes can pick up SDK changes
pnpm --filter @orgname/notify test         # jest, mocks the HTTP layer — no network/DB needed
cd packages/notify && npx jest -t "sends a text message"   # run a single test by name (pnpm's own `test --` double-forwards `--` to jest and breaks arg parsing — use npx jest directly)

pnpm --filter admin dev                   # apps/admin → :3012 (needs .env.local: DATABASE_URL, NOTIFY_MASTER_KEY, SESSION_SECRET, BLOB_READ_WRITE_TOKEN)
pnpm --filter admin seed:admin            # bootstrap the first admin_users row (no signup flow exists)
pnpm --filter admin rotate:master-key     # re-encrypts all tenant credentials after rotating NOTIFY_MASTER_KEY — see the script's own header comment for the full procedure
pnpm --filter @orgname/api-example dev    # apps/api → :3001 (WA_* vars power /demo/*; DATABASE_URL+NOTIFY_MASTER_KEY power /v1/*, independently)
pnpm --filter @orgname/web-example dev    # apps/web → :3000
```

There is no working `lint` command — `turbo run lint` is wired up but no app defines a `lint` script and `packages/notify` references `eslint` without it being installed or configured. Don't invoke it as if it works.

Every app/package builds independently via `tsc`/`next build`; there's no cross-package type-checking shortcut beyond `pnpm --filter <name> exec tsc --noEmit`.

## Architecture

### `packages/notify` — tenant identity is bound at adapter-construction time, not threaded through calls

`NotifyClient` is the orchestrator (`send`, `sendBulk`, `syncTemplates`, `optIn`/`optOut`, webhook methods), composed of `TemplateEngine` (builds the Meta payload — checks `hsmTemplate` → `attachment` → built-in/custom template, in that priority order), `GuardEngine` (opt-in/quiet-hours/mute checks before every send), `EventBus`, an `IQueueAdapter` (`InlineQueueAdapter` runs synchronously; `BullQueueAdapter` is genuinely async via Redis), and an `IStorageAdapter` (`InMemoryAdapter` or `PostgresAdapter`).

Multi-tenancy is layered on **without changing any of the above**: `PostgresAdapter` takes an optional `tenantId` in its constructor and scopes every query to it (defaulting to a constant `LEGACY_TENANT_ID` if omitted, so old single-tenant callers keep working unchanged — never unscoped). `TenantClientRegistry` resolves and caches one full `NotifyClient` per tenant on demand, each with its own tenant-scoped `PostgresAdapter` and its own `WhatsAppHttpClient` (that tenant's access token baked in at construction). No method anywhere takes a `tenantId` parameter — the tenant is fixed for the lifetime of a cached client. `TenantWebhookRouter` extends this to inbound webhooks: it peeks `phone_number_id` out of the raw Meta payload (there's no tenant identifier otherwise), resolves the tenant, then verifies the signature against **that tenant's own** `appSecret` before dispatching — signature verification (`webhook/signature.ts`) fails closed (missing secret/signature → reject), which is a deliberate fix, not the original behavior.

Credential encryption (`security/CredentialCipher.ts`) derives a per-tenant AES-256-GCM key from one root key via HKDF rather than storing per-tenant keys — `MasterKeyRing`/`resolveKeyForVersion`/`reEncryptToCurrentVersion` support rotating the root key without a KMS. `security/PasswordHash.ts` (scrypt) is reused as-is for API key hashing, not just admin passwords — don't mistake it for password-specific.

`WebhookHandler.handleInboundMessage()` persists the reply (`storage.logReply()`), fires `onReply`/the event bus, and runs STOP/START **before** attempting to mark the inbound message as read on Meta's API. That ordering is deliberate, not incidental — the read-receipt call used to run first and, being a real network call to Meta, any failure there (expired token, rate limit, transient outage) silently discarded the reply and skipped STOP/START entirely. It's now try/caught and logged as non-fatal, last. Don't reorder this back without re-introducing that bug.

### `apps/admin` — Next 14 middleware can't run `node:crypto`

Session auth is deliberately split across two layers: `src/middleware.ts` runs on the Edge runtime and can only do a cheap cookie-*presence* check (Next 14's middleware has no Node runtime option, so it can't call `verifySessionToken`, which needs `node:crypto`). The actual authorization boundary is `src/lib/auth.ts`'s `requireAdminSessionOrRedirect()` (Server Components) and `withAdminSession()` (Route Handler wrapper), both of which run in the Node runtime and do real cryptographic verification. Every protected page/route calls one of these explicitly — the middleware is a UX nicety, not the security boundary. Don't "simplify" by moving verification into middleware; it will silently break.

Each tenant's admin screen (`src/app/tenants/[id]/`) is one `Tabs` shell (Analytics — default — / Branding / Credentials / Templates / Test Send / API Keys / Audit Log) with one panel component per tab, each independently fetching and mutating via its own `/api/tenants/[id]/...` routes. `AnalyticsPanel` is the one panel that fetches client-side on mount rather than receiving server-rendered props, since it's meant to be refreshable without reloading the whole page. Campaigns (contacts, broadcast lists, HSM template sends against a list) live on a separate `/tenants/[id]/campaigns` page rather than an eighth tab.

UI is shadcn/ui (`base-nova` style, **Base UI** primitives, not Radix — `render` prop instead of `asChild`) + Tailwind v4, dark mode by default. Two gotchas worth knowing before touching UI code: Next 14.2 doesn't export `Geist` from `next/font/google` (needs Next 15) — the font stack is a plain system-ui fallback, not Geist; and shadcn's generated `Input`/`Textarea` wrappers don't forward refs under React 18, so file-input "clear after upload" logic uses a `key`-based remount instead of `ref.value = ''`.

### `apps/api` — two independent surfaces sharing one process

`/demo/*` (original) is a single hardcoded `NotifyClient` built from `WA_*` env vars, in-memory storage, no auth — a reference for the SDK's basic API shape. `/v1/*` (`src/routes/v1.ts`) is the real multi-tenant surface: `Authorization: Bearer <api key>` resolves a tenant via `lib/apiKeyAuth.ts` (hash lookup by key prefix, same `PasswordHash` primitive as admin logins), then routes through the same `TenantClientRegistry` pattern as `apps/admin`. The two surfaces don't share credentials or storage scope.

Webhook mounts (`notify.webhookExpress(app)` for `/demo`, the `v1Router`'s own webhook routes for `/v1`) are registered **before** the app-wide `express.json()` call in `index.ts`, not after. This is load-bearing: `body-parser`'s json middleware no-ops if the body was already parsed upstream, so a generic parser registered first would silently prevent the webhook route's own `express.json({ verify })` from ever capturing the raw body needed for HMAC signature verification. If you add a new route that needs the raw body, mount it before the generic parser too.

### Database

Migrations are additive and numbered (`001`–`011` in `packages/notify/src/adapters/storage/migrations/`); `001` is the original single-tenant schema (`notify_log`, `notify_preferences`) and is never edited, only extended by later files. `004` is the one genuinely structural migration — it swaps `notify_preferences`'s primary key from `phone` alone to `(tenant_id, phone)`, since the same phone number can be a different tenant's customer with independent consent state. New tenant-scoped tables always get a `tenant_id` FK and an index on `(tenant_id, ...)`. `011` adds `campaigns.broadcast_id`, a real column mirroring the `broadcastId` `BulkSender` already tags into every `notify_log.meta` row during a bulk send — added specifically so analytics queries don't have to reach into jsonb on every read.

### Analytics — live-computed, never cached

`apps/admin/src/lib/analytics.ts` never trusts `campaigns.stats` (a write-once snapshot from the moment `sendBulk()` returned, before any delivery/read webhooks or replies could arrive) — it recomputes everything from `notify_log`/`message_replies` on every request. The per-campaign query uses two separate CTEs (send stats, reply stats) aggregated independently before a final join on `campaign_id`; joining `notify_log` and `message_replies` directly in one query would fan out and inflate the send counts by however many replies each message happened to get. If you touch this query, keep that separation.
