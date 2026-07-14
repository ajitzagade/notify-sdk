# @orgname/notify — Multi-Tenant WhatsApp Notification Platform

A WhatsApp Business Platform SaaS: onboard any number of client businesses, each with fully isolated credentials, branding, contacts, templates, campaigns, and message history — and give each one a programmatic way to send WhatsApp messages without ever touching Meta's API directly.

Started as a single-tenant Node SDK (`packages/notify`); the SDK is still the core of everything, but the platform around it now handles multi-tenant credential management, media/template messaging, campaigns, and a tenant-facing send API.

A shareable, standalone overview of the platform (open it directly in a browser) lives at [`docs/presentation.html`](docs/presentation.html). For a step-by-step walkthrough of setup, onboarding a tenant, and sending a message, see [`docs/getting-started.html`](docs/getting-started.html).

## Packages & apps

| Path | What it is |
|---|---|
| `packages/notify` | The core SDK. Node.js/React/Next.js client, multi-tenant registry, security primitives, storage/queue adapters. See [its README](packages/notify/README.md) for the full API reference. |
| `apps/admin` | **Internal ops panel.** Onboard tenants, manage WhatsApp credentials, branding, templates, contacts/campaigns, API keys, audit log. This is where a business gets set up. |
| `apps/api` | Express app exposing both a single-tenant `/demo/*` reference (uses one hardcoded `.env` credential set) and the multi-tenant `/v1/*` REST API (API-key-authenticated, serves every onboarded tenant). |
| `apps/web` | Next.js reference app showing `@orgname/notify/react` hooks (`useNotify`, `useOptIn`, `useBulkSend`) wired to Next.js API routes. Untouched single-tenant demo — a pattern to copy, not something a tenant talks to directly. |
| `packages/mcp-server` | MCP (Model Context Protocol) server exposing a tenant's `/v1` API to Claude Desktop, Cursor, and other MCP-compatible AI assistants. Read-only by default; write tools are opt-in. See [its README](packages/mcp-server/README.md). |

## Scenarios this platform covers

**Transactional messaging**
- OTP / verification codes
- Task assignments with action buttons (Acknowledge / Mark done / Snooze)
- Approval workflows (Approve / Reject / Defer)
- Status change notifications
- Generic alerts with up to 3 quick-reply buttons

**Operational notifications**
- Deploy/CI alerts with custom templates (View logs / Rollback buttons)
- Scheduled delivery (send at a specific future time)
- Quiet-hours and mute enforcement per recipient

**Rich media**
- Images, videos, documents, and audio with captions, sent via a public URL (e.g. Vercel Blob) — no need to pre-upload to Meta
- A per-tenant media library in the admin panel to reuse uploaded assets

**Marketing & broadcast campaigns**
- Real Meta-approved (HSM) templates — sync a tenant's approved template list from Meta and send it, which is what's actually required to message someone outside the 24-hour session window
- CSV contact import with an explicit consent-attestation step (never silently opts anyone in)
- Persisted broadcast lists and campaign runs with sent/failed/skipped stats

**Two-way conversations**
- Inbound message and button-click webhooks routed to the correct tenant automatically
- STOP/START auto opt-out/opt-in
- Signature-verified webhooks (fails closed if unconfigured — never silently accepts unsigned events)

**Multi-tenant SaaS operations**
- Ops onboard a business in the admin panel: name, logo, brand color, WhatsApp credentials (verified against Meta before saving)
- Every tenant's access tokens are encrypted at rest (AES-256-GCM, per-tenant derived keys) with a documented root-key rotation flow
- Complete data isolation — one tenant's message log, contacts, templates, and credentials are never reachable from another tenant's context, enforced at the storage layer, not just the UI
- Audit log of who changed what and when
- Live analytics — sent/delivered/read/failed/reply rollups and per-campaign performance, computed on every request, never a cached snapshot

**AI & automation**
- Per-tenant AI reply assistant (bring your own OpenAI/Anthropic key) that auto-answers inbound messages, capped per conversation, with a deterministic handoff to a human when it can't help
- Outbound event webhooks — push send/delivery/reply events to a tenant's own systems, HMAC-signed and SSRF-guarded
- A shared inbox for support agents: merged message history per contact, assignment, status, reply — all through the same send path as everything else
- Contact tags for segmentation, with tag-merge-on-import vs. explicit-replace-on-edit semantics
- An MCP server so Claude, Cursor, and other AI assistants can read a tenant's message history (and, opt-in, send messages) the same way any other integration would

## How other apps integrate

There are two ways to send WhatsApp messages through this platform, depending on what you're building.

### 1. Tenant-facing REST API (recommended for external apps)

Any backend, in any language, that doesn't want to manage WhatsApp credentials or embed a Node SDK. An ops admin issues your team an API key in `apps/admin` (Tenant → API keys tab); you call the platform's `/v1` endpoints with it.

```bash
curl -X POST https://<api-host>/v1/send \
  -H "Authorization: Bearer nsk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "to": "919876543210",
    "template": "text",
    "text": "Your order has shipped!"
  }'
```

Available endpoints (all require `Authorization: Bearer <api key>` except the webhook):

| Method & path | Purpose |
|---|---|
| `POST /v1/send` | Send a single message — text, template, media (`attachment`), or real HSM template (`hsmTemplate`) |
| `POST /v1/send-bulk` | Send to many recipients at once |
| `POST /v1/opt-in` / `POST /v1/opt-out` | Manage recipient consent |
| `GET /v1/logs` | Recent notification history for your tenant only |
| `GET`/`POST /v1/webhook/whatsapp` | Meta's shared webhook callback (see `apps/api/.env.example` for `PLATFORM_WEBHOOK_VERIFY_TOKEN` setup) |

The API is rate-limited per tenant (60 req/min) and CORS-permissive by design — the API key is the actual auth boundary, this is meant to be called server-to-server, not from a browser. See `apps/api/src/routes/v1.ts` for the full request/response shapes (they mirror `SendOptions` from the SDK — see the [SDK README](packages/notify/README.md#sending-messages)).

### 2. Embed the SDK directly (for Node apps inside this monorepo, or a single-tenant deployment)

```bash
npm install @orgname/notify
```

```ts
import { NotifyClient } from '@orgname/notify';

const notify = new NotifyClient({
  accessToken:   process.env.WA_ACCESS_TOKEN!,
  phoneNumberId: process.env.WA_PHONE_NUMBER_ID!,
});

await notify.send({ to: '919876543210', template: 'text', text: 'Hello!' });
```

This is the right choice if you're adding a new app to this monorepo (like `apps/api`/`apps/web` do) or running your own single-tenant deployment with your own Meta credentials. For multi-tenant hosting (serving many businesses' credentials from one process), use `TenantClientRegistry` — see [Multi-tenant hosting](packages/notify/README.md#multi-tenant-hosting) in the SDK README.

### 3. MCP server (for AI assistants)

For letting Claude Desktop, Cursor, or another MCP-compatible assistant read a tenant's message history or send messages on its behalf — same tenant API key as option 1, no new credentials. See [`packages/mcp-server`](packages/mcp-server/README.md) for setup.

## Getting started locally

### 1. Install dependencies

```bash
npm install -g pnpm
pnpm install
```

### 2. Start Postgres

```bash
docker compose up -d
```

Applies to `apps/admin` and `apps/api`'s `/v1/*` routes (multi-tenant mode). Not needed for `apps/web` or `apps/api`'s `/demo/*` routes, which default to in-memory storage.

### 3. Run the SDK's migrations

```bash
for f in packages/notify/src/adapters/storage/migrations/*.sql; do
  PGPASSWORD=notify psql -h localhost -p 5434 -U notify -d notify_sdk -f "$f"
done
```

### 4. Build the SDK

```bash
pnpm --filter @orgname/notify build
```

### 5. Set up and run the admin panel

```bash
cd apps/admin
cp .env.example .env.local
# fill in DATABASE_URL, NOTIFY_MASTER_KEY (openssl rand -base64 32), SESSION_SECRET (same),
# BLOB_READ_WRITE_TOKEN (from a Vercel Blob store), ADMIN_SEED_EMAIL/PASSWORD
pnpm seed:admin
pnpm dev
# → http://localhost:3012/login
```

From here: log in, create a tenant, add branding + WhatsApp credentials (verified live against Meta), sync templates, and send a test message — all from the UI.

### 6. Set up and run `apps/api`

One `.env` file covers both surfaces this app exposes:

```bash
cd apps/api
cp .env.example .env
# WA_ACCESS_TOKEN etc. → powers the single-tenant /demo/* routes (in-memory storage, no DB needed)
# DATABASE_URL, NOTIFY_MASTER_KEY (must match apps/admin's exactly), PLATFORM_WEBHOOK_VERIFY_TOKEN
#   → powers the multi-tenant /v1/* routes (needs Postgres from step 2)
pnpm dev
# → http://localhost:3001
```

Fill in only the section you need — the two surfaces don't depend on each other. For `/v1/*`, issue yourself an API key from the admin panel's Tenant → API keys tab, then `curl -H "Authorization: Bearer nsk_..." .../v1/send`.

### 7. Run the Next.js demo (optional, single-tenant)

```bash
cd apps/web
cp .env.example .env.local
pnpm dev
# → http://localhost:3000/demo
```

### 8. Run the SDK's own tests

```bash
cd packages/notify
pnpm test
```

### 9. Run the MCP server (optional)

```bash
cd packages/mcp-server
pnpm build
NOTIFY_API_KEY=nsk_... node dist/index.js   # same tenant API key as step 6
```

See [`packages/mcp-server/README.md`](packages/mcp-server/README.md) for env vars and an example MCP client config.

## Note: real messages require real Meta credentials

Every credential-dependent action (sending, template sync, webhook verification) fails gracefully with a clear error if Meta rejects the credentials — nothing crashes without them, but nothing actually delivers to a real phone either. The SDK's own test suite mocks the HTTP layer, so `pnpm test` works fully offline.
