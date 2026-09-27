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

## Work item 5 — Caller-supplied button IDs

Added after Cliniqly's own implementation surfaced it: `SendOptions.buttons` only ever
accepted plain string labels, and `TemplateEngine`'s `interactive_buttons` branch always
auto-generated the reply id (`btn_{index}_{refId}`). Cliniqly's state machine encodes its own
reply ids (e.g. `CANCEL_APPOINTMENT:123`) — same shape list rows already support via `list.id`
— but had no equivalent for quick-reply buttons.

- **Shipped**: `buttons` widened to `Array<string | {id, title}>` — additive; a plain string
  keeps today's auto-generated id exactly as before, an `{id, title}` object supplies its own.
  Mixed arrays work (some auto, some caller-supplied, in the same send). Still capped at 3.
  Byte-identical-output regression test for the existing string-only form.

## Verification checklist

> **Note on this section's provenance**: this checklist and the Work item 5 description above
> were originally written after a round of real integration work in the Cliniqly repo, then
> lost to an accidental `git reset --hard` before being committed (see the notify-sdk session
> that reconstructed this — the exact original wording/full item list is not recoverable). What
> follows is a reconstruction: the three concerns the user could recall precisely
> (waMessageId synchronicity, retry re-signing, payload nesting) plus the confirmed existence of
> an item 8 (partner-key rotation docs), each verified from scratch against the actual code
> rather than assumed. Items are unordered relative to whatever the original numbering was.

- [x] **waMessageId synchronicity** — does `client.send()`'s returned `NotifyEvent` reliably
      have `waMessageId` populated by the time the HTTP response goes out, for every path
      `/v1/send` and `/partner/*`-provisioned tenants actually use?
      **Confirmed correct**, not a bug: `NotifyClient.ts`'s `send()` re-reads the actual
      `notify_log` row via `storage.getEvent(logId)` after `queue.enqueue()` rather than
      trusting an earlier "queued" snapshot (see the comment at the call site), and
      `InlineQueueAdapter.enqueue()` — what every tenant client actually uses, since
      `TenantClientRegistry` never overrides `queueFactory` — `await`s the job handler
      to completion for the no-delay case rather than firing-and-forgetting. `executeJob()`
      writes `waMessageId` to storage before returning and before emitting `'sent'`. The one
      real edge case (accurate, but previously undocumented): a `scheduleAt` send, or a
      deployment using `BullQueueAdapter`, correctly returns `status: 'queued'` with no
      `waMessageId` yet — now documented in `packages/notify/README.md`.

- [x] **Retry re-signing / idempotency** — does retrying one of the partner endpoints (client
      timeout, not knowing if the first attempt succeeded) produce a different secret/signature
      than the original call, in a way that could silently break a caller who kept only the
      latest response?
      **Real gap found and fixed**: `POST /partner/tenants/:id/webhook-endpoints` minted a
      brand-new `whsec_` secret and inserted a new row on every call, with no dedup — a retry
      would leave two active endpoints receiving duplicate deliveries, one signed with a secret
      the caller no longer has on file if they only kept the newest response. Fixed in
      `packages/notify/src/provisioning/tenantProvisioning.ts`'s `createWebhookEndpoint()`: now
      checks for an existing active endpoint with the same `(tenantId, url, events)` (order-
      independent event comparison) before inserting, and returns that endpoint's real
      (decrypted) id/secret again rather than minting a duplicate. A genuinely different
      `events` subset for the same URL still creates a new row, as intended. The other
      secret-issuing/write paths were already correct: `/credentials` and `/embedded-signup`
      use `ON CONFLICT (tenant_id) DO UPDATE` (confirmed idempotent); `/api-key` is
      deliberately non-idempotent by design — this endpoint's own stated purpose is "issue
      (or rotate)," so a second call minting a new key is correct behavior, not a bug.

- [x] **Payload nesting consistency** — do all outbound webhook event types
      (`sent`/`delivered`/`read`/`failed`/`reply`) nest under `{event, data}` the same way, with
      no per-event-type special-casing or accidental double-nesting (e.g. `reply`'s own
      `rawPayload` sub-object)?
      **Confirmed correct**, evidenced by a new test
      (`OutboundWebhookDispatcher.test.ts`, "nests every event type identically") that runs a
      `sent`, `delivered`, `failed`, and `reply` (including a nested `rawPayload`) payload
      through `deliverSignedWebhook` and asserts every one produces the exact same top-level
      `{event, data}` shape. The single wrap point (`OutboundWebhookDispatcher.ts`'s
      `JSON.stringify({event, data: payload})`) is shared by every call site in both apps'
      `tenantRegistry.ts` — no event type nests differently.

- [x] **Item 8 — partner-key issuance/rotation procedure** — documented in
      `docs/partner-api-reference.md` ("Issuing a new partner key" / "Rotating or revoking a
      partner key"): no self-serve endpoint (deliberate), the exact scrypt-hash-and-insert
      script, and the issue-new-then-revoke-old rotation procedure.
