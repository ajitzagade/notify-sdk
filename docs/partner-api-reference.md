# Partner provisioning API

Server-to-server API for a partner platform (e.g. Cliniqly) to onboard client
businesses programmatically, without an admin-console session. Every tenant
created this way is a first-class notify-sdk tenant — same registry, same
credential encryption, same webhook routing as one created through the admin
console. See `docs/cliniqly-integration-brief.md` for the full context.

This is a separate door from the tenant-facing `/v1/*` API — see
`packages/notify/README.md`'s "Multi-tenant hosted API" section for that one.
Nothing here is reachable with a tenant's own `nsk_` key, and a partner key
cannot be used on `/v1/*`.

## Authentication

Every request needs `Authorization: Bearer <partner key>`, where the key is
prefixed `psk_` — deliberately distinct from tenant keys (`nsk_`) so the two
are never visually or programmatically interchangeable. A key in the wrong
place is rejected outright:

```
Authorization: Bearer nsk_...   on /partner/*  → 401 "Invalid partner key format"
Authorization: Bearer psk_...   on /v1/*       → 401 "Invalid API key format"
```

Partner keys are issued directly in the `partner_api_keys` table today (no
self-serve issuance endpoint — ask an operator). They can be labeled and
revoked (`revoked_at`) but are not tenant-scoped: one key can provision any
number of tenants.

### Issuing a new partner key

There is no `POST` endpoint for this (deliberately — creating a key that can
create tenants is an operator action, not something to expose over the
network the key itself would authenticate). Generate one with the SDK's own
`hashPassword` primitive (the same scrypt-based hash used for tenant `nsk_`
keys and admin passwords — never store a partner key's plaintext):

```ts
// One-off script, run with DATABASE_URL pointed at the target environment.
import crypto from 'crypto';
import { hashPassword } from '@orgname/notify';
import { Pool } from 'pg';

const secret    = crypto.randomBytes(24).toString('base64url');
const keyPrefix = secret.slice(0, 8);       // must match KEY_PREFIX_LENGTH in partnerKeyAuth.ts
const fullKey   = `psk_${secret}`;          // give this to the partner ONCE — it is never recoverable after

const { hash, salt } = await hashPassword(fullKey);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
await pool.query(
  `INSERT INTO partner_api_keys (key_prefix, key_hash, key_salt, label) VALUES ($1, $2, $3, $4)`,
  [keyPrefix, hash, salt, 'Cliniqly integration']
);
```

`keyPrefix` must be exactly 8 characters (`KEY_PREFIX_LENGTH` in
`apps/api/src/lib/partnerKeyAuth.ts`) — it's how `requirePartnerKey` finds the
candidate row(s) to verify against before hashing, without a full-table scan.

### Rotating or revoking a partner key

Rotation is issue-new-then-revoke-old, not an in-place update — there is no
"same key, new secret" operation, matching how tenant `nsk_` keys work:

1. Issue a new key (above) and hand it to the partner.
2. Once they've confirmed the new key works (e.g. a real `GET
   /partner/tenants/:id/status` call), revoke the old one:
   ```sql
   UPDATE partner_api_keys SET revoked_at = NOW() WHERE key_prefix = '<old prefix>';
   ```
   `requirePartnerKey` filters `WHERE ... AND revoked_at IS NULL`, so a
   revoked key 401s immediately on its next use — no propagation delay,
   no cache to bust.
3. To revoke without replacing (e.g. a suspected leak), just do step 2 alone.
   There's no "disable temporarily" state — revocation is one-way; issue a
   fresh key to resume access.

## Base URL

`https://api.azentis.in/partner` in production; `http://localhost:3001/partner`
locally (or whatever `PORT` is set to).

## Endpoints

### `POST /partner/tenants`

Creates a new tenant.

```json
// Request
{ "name": "Acme Clinic", "category": "healthcare", "autoReplyEnabled": false }
```

- `name` (required)
- `slug` (optional) — if omitted, one is derived from `name` and made unique
  automatically (e.g. `acme-clinic`, `acme-clinic-2`, ...). If supplied, it
  must match `^[a-z0-9]+(-[a-z0-9]+)*$`, 2–100 chars, and a collision is a
  hard error rather than silently changed.
- `category` (optional) — free text (e.g. `healthcare`); drives which
  starter templates a tenant sees in the admin console's template gallery.
- `autoReplyEnabled` (optional, default `true`) — set to `false` for a
  tenant whose own system (e.g. Cliniqly) answers every inbound message
  itself, so the platform's AI auto-reply and keyword automation flows never
  also respond. Editable later in the admin console's tenant settings.

```json
// Response 201
{ "tenantId": "...", "name": "Acme Clinic", "slug": "acme-clinic", "category": "healthcare" }
```

### `POST /partner/tenants/:id/api-key`

Issues a new `nsk_` API key for the tenant's own `/v1/*` calls (send, opt-in/out,
logs). Calling this again issues an additional key — it does not rotate or
invalidate a previous one; revoke unwanted keys separately.

```json
// Request (optional)
{ "label": "Cliniqly integration" }

// Response 201 — the plaintext key is shown exactly once
{ "apiKey": "nsk_...", "keyId": "...", "keyPrefix": "..." }
```

### `POST /partner/tenants/:id/webhook-endpoints`

Registers an outbound webhook endpoint — the tenant's own system will receive
signed HTTP POSTs for the selected events (`sent`, `delivered`, `read`,
`failed`, `reply`). See `packages/mcp-server` or `packages/notify`'s
`verifyWhatsAppSignature`-adjacent `X-Notify-Signature` header for how to
verify the HMAC signature on receipt.

```json
// Request
{ "url": "https://cliniqly.example/hooks/notify", "events": ["reply", "sent"] }

// Response 201 — the signing secret is shown exactly once
{ "endpointId": "...", "secret": "whsec_..." }
```

An endpoint auto-disables after 10 consecutive delivery failures.

### `POST /partner/tenants/:id/credentials`

Manual/BYO credential connection — for a client business that already has its
own Meta WhatsApp Business Account and access token. Re-verified live against
Meta before being persisted; a bad token is rejected (422), never trusted
as-is.

```json
// Request
{
  "accessToken": "EAAG...",
  "phoneNumberId": "1234567890",
  "wabaId": "9876543210",
  "appSecret": "optional — needed for this tenant's own inbound webhook signature verification"
}

// Response 200
{ "ok": true, "verifiedName": "Acme Clinic", "displayPhoneNumber": "+91 90000 00000",
  "verifyToken": "...", "webhookWarning": null }
```

`webhookWarning` is set (non-fatal) if `wabaId` was omitted or the webhook
subscription call failed — credentials are still saved, but inbound
replies/status updates won't arrive until it's fixed.

### `POST /partner/tenants/:id/embedded-signup`

Completes a WhatsApp Embedded Signup flow — the browser-side popup hands back
a one-shot OAuth `code` plus the WABA/phone IDs Meta posted to the opener
window; this endpoint exchanges the code and finishes onboarding server-side.
**The code expires in ~30 seconds — call this immediately on receipt.**
Retrying on a transient failure is safe (the underlying write is an upsert).

Only usable once the platform's own Meta Tech Provider app has cleared App
Review and Publish (see `docs/phase2-launch-checklist.md`) and the
`META_APP_ID`/`META_APP_SECRET` env vars are set — otherwise this 503s with
`"Embedded Signup is not enabled on this deployment"`, identical to the admin
console's own dormant-until-launch behavior.

```json
// Request
{ "code": "...", "wabaId": "...", "phoneNumberId": "..." }

// Response 200
{ "ok": true, "displayName": "Acme Clinic", "displayPhoneNumber": "+91 90000 00000" }
```

A `phoneNumberId` already connected to another tenant is a 409, not a silent
takeover.

### `GET /partner/tenants/:id/status`

Read-only snapshot: connection state, onboarding method, and template
approval statuses.

```json
{
  "tenantId": "...", "name": "Acme Clinic", "slug": "acme-clinic",
  "category": "healthcare", "autoReplyEnabled": false,
  "connection": {
    "configured": true, "phoneNumberId": "...", "wabaId": "...",
    "onboardingMethod": "manual", "lastVerifiedAt": "...", "lastVerifiedStatus": "ok"
  },
  "templates": [{ "name": "appointment_reminder", "language": "en_US", "status": "APPROVED" }]
}
```

`connection.configured: false` before any credentials/embedded-signup call has
succeeded.

## Errors

All error responses are `{ "error": "<message>" }` with a matching HTTP status
(400 validation, 401 auth, 404 unknown tenant, 409 conflict, 422 Meta
rejected the input, 502 Meta call failed, 503 feature not enabled).
