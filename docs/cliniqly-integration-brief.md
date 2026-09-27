# Cliniqly integration — notify-sdk work brief

**Status: approved plan, ready to implement. Read fully before writing code.**

## Context (you have none from the planning session, so here it is)

Cliniqly is a separate repo (`~/Desktop/Development/Cliniqly`) — a multi-tenant clinic
management SaaS with a fully built WhatsApp appointment-booking conversation engine
(consent → name → age → gender → slot selection, Redis state, slot locking, Inngest jobs for
confirmations/reminders/cancellations). Today it talks to Meta's Cloud API directly with one
shared system token. The decision: swap its transport layer to **this platform's hosted `/v1`
API**, so every clinic onboards as a **notify-sdk tenant** under the already-verified,
already-published Tech Provider Meta app. Cliniqly keeps the booking brain; notify-sdk owns
all Meta credentials and transport.

**Cliniqly-side work (send adapter, webhook bridge, onboarding UI) is out of scope here.**
This brief covers only the notify-sdk side: four additive work items.

## Hard constraints — non-negotiable

1. **Additive only. Zero behavior change for existing tenants/customers.** New endpoints, new
   optional fields, new opt-in flags whose defaults preserve today's behavior exactly. No
   edits to existing route behavior, the tenant model, credential handling, admin console,
   portal, or `/demo`.
2. DB migrations: numbered, additive, idempotent — next number after the current highest in
   `packages/notify/src/adapters/storage/migrations/`.
3. Run the full existing test suite before and after; add regression tests for every seam you
   touch.
4. Do not add native Meta "WhatsApp Flows" support — explicitly out of scope.

## Work item 1 — Partner provisioning API (new routes, `apps/api`)

Server-to-server API so a partner platform (Cliniqly) can onboard clinics programmatically.
Today tenant creation / key issuance / credential entry / embedded-signup completion are all
locked behind admin-console sessions — that stays; this is a parallel door.

- **Auth**: a new partner-level key (env `PARTNER_API_KEY` or a `partner_api_keys` table,
  scrypt-hashed like the existing `nsk_` handling in `apps/api/src/lib/apiKeyAuth.ts`).
  Entirely separate from tenant `nsk_` keys. Never reuse admin session auth.
- **Endpoints** (suggested; keep the style of `apps/api/src/routes/v1.ts`):
  - `POST /partner/tenants` — create tenant (name, category e.g. `healthcare`, timezone;
    optional `auto_reply_enabled: false` — see item 4). Returns `tenant_id`.
  - `POST /partner/tenants/:id/api-key` — issue (or rotate) the tenant's `nsk_` key; plaintext
    returned exactly once.
  - `POST /partner/tenants/:id/webhook-endpoints` — register an outbound webhook endpoint
    (URL + returns signing secret). Reuse the existing `webhook_endpoints` table/dispatcher.
  - `POST /partner/tenants/:id/credentials` — manual/BYO credential passthrough (phone number
    ID, WABA ID, permanent token, app secret). **Reuse the existing live-verification logic**
    behind `apps/admin/.../credentials` + `credentials/verify` — do not reimplement.
  - `POST /partner/tenants/:id/embedded-signup` — accept `{code, wabaId, phoneNumberId}` and
    run the same orchestration as `completeEmbeddedSignup()` in
    `apps/admin/src/lib/embeddedSignup.ts` / `metaGraph.ts`.
    ⚠️ Design decision to make deliberately: that logic lives in `apps/admin`, and `apps/api`
    would need it too. Prefer extracting the shared orchestration into a workspace package
    (or a shared lib both apps import) over duplicating it. Both apps already share
    `DATABASE_URL` + `NOTIFY_MASTER_KEY`, so the crypto/storage layer is common.
  - `GET /partner/tenants/:id/status` — connection state, template approval statuses,
    onboarding_method.
- Remember the ~30s OAuth code TTL on embedded signup: the endpoint must exchange the code
  immediately, and retries must be safe (existing upsert semantics already are).

## Work item 2 — Interactive list messages (the slot picker needs them)

Cliniqly's appointment slot picker sends a WhatsApp **list message** (up to 10 rows). The
platform currently supports only ≤3 quick-reply buttons.

- `packages/notify/src/core/TemplateEngine.ts`: the dispatch is a strict if-chain —
  `hsmTemplate` → `attachment` → `template === 'text'` → `template === 'interactive_buttons'`
  → registry lookup. Add a `template === 'interactive_list'` branch. This value is provably
  unused today (it would currently fall through to the registry and throw "Template not
  found"), so the branch cannot affect any existing caller.
- Payload shape (Meta Graph): `type: 'interactive'`, `interactive.type: 'list'`, with header
  text, body text, button label, and `sections[].rows[]` — row `id`, `title` (≤24 chars,
  truncate), optional `description` (≤72 chars, truncate), max 10 rows total.
- Extend `SendOptions` in `packages/notify/src/types/index.ts` (e.g. `listHeader`,
  `listButtonLabel`, `listRows` — or a single `list` object; match existing naming style).
- Expose through `POST /v1/send` validation in `apps/api/src/routes/v1.ts`.
- `WhatsAppHttpClient` likely needs nothing (it posts the built payload as-is) — verify, don't
  assume.
- Tests: new branch unit tests + one assertion that existing types' output is unchanged.

## Work item 3 — Reply/status payload completeness (verify first, then extend)

Cliniqly's state machine routes on interactive reply IDs (`button_reply.id` /
`list_reply.id`, e.g. `CANCEL_APPOINTMENT:{id}`, encoded slot IDs) and correlates delivery
status by Meta message ID (`wamid`) for its SMS-fallback path.

- **Verify** what the `reply` outbound-webhook payload contains today (`WebhookHandler` →
  `message_replies` → `dispatchOutboundWebhooks('reply')`). If interactive reply `id` +
  `title` aren't included, add them as **new fields** on the payload.
- **Verify** the `POST /v1/send` response and the `sent/delivered/read/failed` webhook
  payloads expose the Meta message ID. Add if missing — additive fields only.
- Safe by construction: `OutboundWebhookDispatcher` signs the final serialized body
  (`JSON.stringify({event, data})` then HMAC), so added fields can't break existing
  consumers' signature verification, and unknown JSON fields are ignored. Extend
  `packages/notify/tests/OutboundWebhookDispatcher.test.ts` as the regression guard.

## Work item 4 — Per-tenant auto-reply kill switch

Cliniqly answers every patient message itself; the platform's AI auto-reply and keyword
automation flows must never respond for clinic tenants (double-reply risk).

- Today both are already self-gating (flows need an active `flow_definitions` keyword match;
  AI needs an `ai_configs` row), so clinic tenants are silent by default. This flag is
  belt-and-braces against future accidental configuration.
- Add a tenant-level flag (additive migration, e.g. `tenants.auto_reply_enabled BOOLEAN
  DEFAULT TRUE` — default TRUE preserves current behavior for every existing tenant).
- Enforce at the dispatch seam in `apps/api/src/lib/tenantRegistry.ts` (~line 93): the
  `dispatchAutomationFlow(...).then(handled => !handled && dispatchAiAutoReply(...))` chain
  runs only when the flag is true.
- Settable at creation via the partner API (item 1) and editable in admin.

## Acceptance criteria

- [ ] Full existing test suite green, plus new tests for each item.
- [ ] A tenant created via the partner API behaves identically to an admin-created one
      (registry, isolation, encryption, webhook routing).
- [ ] `POST /v1/send` with every pre-existing payload shape produces byte-identical Meta
      payloads (snapshot/regression test).
- [ ] Existing webhook consumers keep verifying signatures successfully after payload
      additions.
- [ ] All existing tenants have `auto_reply_enabled = true` after migration; behavior
      unchanged.
- [ ] No admin console, portal, `/demo`, or existing `/v1` route behavior modified.
- [ ] `docs/` updated: partner API reference + list-message docs.

## Sequencing suggestion

Item 4 (small, isolated) → item 2 (self-contained) → item 3 (verify-then-extend) → item 1
(largest; the embedded-signup logic-sharing decision is its main design question). Items are
independent enough to review/merge separately — keep them as separate commits or PRs.
