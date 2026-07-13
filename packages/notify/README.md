# @orgname/notify

WhatsApp notification SDK — drop into any Node.js, React or Next.js app in the organisation with two lines of setup.

## Quick start

```bash
npm install @orgname/notify
```

```ts
import { NotifyClient } from '@orgname/notify';

const notify = new NotifyClient({
  accessToken:   process.env.WA_ACCESS_TOKEN!,
  phoneNumberId: process.env.WA_PHONE_NUMBER_ID!,
});

// Opt in the user once
await notify.optIn('919876543210');

// Send a message
await notify.send({ to: '919876543210', template: 'text', text: 'Hello!' });
```

No Redis, no database needed for development — defaults to in-memory adapters.

---

## Use cases

- **Transactional**: OTP codes, task assignments, approval requests, status updates — see [Built-in templates](#built-in-templates)
- **Operational alerts**: deploy notifications, custom interactive templates with action buttons
- **Rich media**: images, videos, documents, audio with captions — see [Sending media](#sending-media)
- **Marketing/broadcast campaigns**: real Meta-approved templates that work outside the 24h session window — see [Real WhatsApp templates (HSM)](#real-whatsapp-templates-hsm)
- **Two-way conversations**: inbound replies, button clicks, automatic STOP/START handling — see [Webhooks](#webhooks)
- **Multi-tenant hosting**: serve N businesses' WhatsApp credentials from one process, fully isolated — see [Multi-tenant hosting](#multi-tenant-hosting)

---

## Installation

### In the monorepo (workspace reference)

Add to your app's `package.json`:

```json
{
  "dependencies": {
    "@orgname/notify": "workspace:*"
  }
}
```

### Outside the monorepo (private registry)

```bash
npm install @orgname/notify
```

---

## Environment variables

Copy `.env.example` to `.env` and fill in:

```bash
WA_ACCESS_TOKEN=     # permanent system user token from Meta Developer Dashboard
WA_PHONE_NUMBER_ID=  # Phone Number ID from Meta Developer Dashboard
WA_VERIFY_TOKEN=     # any string you choose for webhook verification
WA_APP_SECRET=       # App Secret for webhook HMAC validation (optional but recommended)
```

Get these from https://developers.facebook.com → Your App → WhatsApp → API Setup.

---

## Configuration

```ts
const notify = new NotifyClient({
  // Required
  accessToken:   '...',
  phoneNumberId: '...',

  // Optional — webhook
  verifyToken:  '...',
  appSecret:    '...',

  // Optional — queue (default: InlineQueueAdapter, no Redis)
  queue: new BullQueueAdapter(process.env.REDIS_URL!),  // production

  // Optional — storage (default: InMemoryAdapter, no DB)
  storage: new PostgresAdapter(pgPool),  // production

  // Optional — global defaults
  defaults: {
    timezone:   'Asia/Kolkata',
    quietHours: { start: 22, end: 8 },  // don't send 10pm–8am
    retries:     3,
  },

  // Optional — lifecycle hooks
  onSent:      (event)       => console.log('Sent:', event),
  onFailed:    (event, err)  => console.error('Failed:', err),
  onReply:     (reply)       => handleReply(reply),
  onDelivered: (event)       => console.log('Delivered:', event),
  onRead:      (event)       => console.log('Read:', event),
});
```

---

## Sending messages

### Single send

```ts
// Free-form text (only works within 24h customer service window)
await notify.send({ to: '919876543210', template: 'text', text: 'Hello!' });

// Built-in OTP template
await notify.send({
  to:       '919876543210',
  template: 'otp',
  data:     { code: '847291', expiresIn: '5 minutes' },
  priority: 'high',  // skip queue, send immediately
});

// Built-in task_assigned template (with action buttons)
await notify.send({
  to:       '919876543210',
  template: 'task_assigned',
  data: {
    title:      'Review PR #482',
    priority:   'high',
    project:    'Mobile App',
    assignedBy: 'Priya (PM)',
    dueDate:    'Tomorrow 5pm',
    taskId:     'task-001',
  },
  tags: ['tasks'],          // for log filtering
  meta: { taskId: 'task-001' },
});

// Scheduled delivery
await notify.send({
  to:         '919876543210',
  template:   'reminder',
  data:       { title: 'Sprint planning', body: 'Starts in 1 hour' },
  scheduleAt: new Date('2026-06-20T09:00:00+05:30'),
});
```

### Bulk send

```ts
const result = await notify.sendBulk({
  recipients: ['919876543210', '919123456789', '918765432100'],
  template:   'alert',
  data: {
    title:   'Production deployed',
    body:    'v2.4.0 is live',
    buttons: ['View changelog'],
    refId:   'deploy-001',
  },
  batchSize:             50,   // process 50 at a time
  delayBetweenBatchesMs: 1000, // 1s between batches
  onProgress: (p) => console.log(`${p.percent}% — ${p.sent}/${p.total}`),
});
// result: { broadcastId, total, sent, failed, skipped, durationMs }
```

### Named broadcast lists

```ts
// Define once (e.g. in your app startup)
notify.broadcastLists
  .define({ name: 'engineering', phones: ['919876543210', '919123456789'] })
  .define({ name: 'all-hands',   phones: ['919876543210', '919123456789', '918765432100'] });

// Add / remove members dynamically
notify.broadcastLists.addMember('engineering', '916543210987');
notify.broadcastLists.removeMember('engineering', '919123456789');

// Send to a list
await notify.sendToList('engineering', {
  template: 'alert',
  data: { title: 'PR review needed', body: 'PR #499 is waiting', buttons: ['View PR'] },
});
```

### Sending media

Pass a public HTTPS URL (e.g. a Vercel Blob URL) — Meta fetches it directly, no need to pre-upload:

```ts
await notify.send({
  to:       '919876543210',
  template: 'text', // ignored when attachment is set
  attachment: {
    type:     'image',       // 'image' | 'video' | 'document' | 'audio'
    link:     'https://example.com/invoice.pdf',
    caption:  'Your invoice for March',  // not supported for type 'audio'
    filename: 'invoice.pdf',              // only used for type 'document'
  },
});
```

For reusing the same uploaded asset across many sends without re-uploading each time, `WhatsAppHttpClient.uploadMedia()`/`getMediaUrl()` upload to Meta once and return a media ID you can pass as `attachment.id` instead of `link` — this is an advanced path (accessed via `NotifyClient`'s internal `http` client); for almost all cases, passing a public `link` (e.g. a Vercel Blob URL, as `apps/admin` does) is simpler and sufficient.

### Real WhatsApp templates (HSM)

The templates above (`registerTemplate`, built-ins) are local JS functions producing free-form **session messages** — they only deliver within a 24-hour window after the user last messaged you. To message someone outside that window (most marketing/campaign use cases), you need one of Meta's own pre-approved templates:

```ts
// Requires config.wabaId (WhatsApp Business Account ID — template listing is
// WABA-scoped, not phone-number-scoped)
const templates = await notify.syncTemplates();
// → [{ id, name, language, category, status, components }, ...]

await notify.send({
  to:       '919876543210',
  template: 'text', // ignored when hsmTemplate is set
  hsmTemplate: {
    name:     'order_shipped',
    language: 'en_US',
    components: [
      { type: 'body', parameters: [{ type: 'text', text: 'Priya' }, { type: 'text', text: '#4821' }] },
    ],
  },
});
```

Authoring/submitting new templates to Meta for approval isn't part of this SDK — sync and send only. `apps/admin` has a UI for both syncing a tenant's approved templates and composing a parameterized send against one.

---

## Built-in templates

| Name | Description | Required data fields |
|---|---|---|
| `text` | Free-form text message | `text` on SendOptions |
| `alert` | Text + up to 3 buttons | `body`, `buttons[]`, `refId` |
| `reminder` | Simple reminder | `title`, `body`, `dueDate` |
| `approval_request` | Approve / Reject / Defer | `title`, `requestedBy`, `refId` |
| `status_update` | Status change | `entity`, `from`, `to` |
| `otp` | Verification code | `code`, `expiresIn` |
| `task_assigned` | Task with action buttons | `title`, `priority`, `taskId`, `assignedBy` |
| `task_due_soon` | Due date reminder | `title`, `priority`, `taskId`, `dueDate`, `status` |

### Register a custom template

```ts
notify.registerTemplate('deploy_alert', (data, to) => ({
  type: 'interactive',
  interactive: {
    type: 'button',
    header: { type: 'text', text: `Deploy ${data.status}` },
    body:   { text: `${data.service} v${data.version} → ${data.env}` },
    action: {
      buttons: [
        { type: 'reply', reply: { id: `view_${data.deployId}`, title: 'View logs' } },
        { type: 'reply', reply: { id: `rb_${data.deployId}`,   title: 'Rollback'  } },
      ],
    },
  },
}));
```

---

## Opt-in / opt-out / mute

```ts
await notify.optIn('919876543210');               // sends confirmation, sets optedIn=true
await notify.optOut('919876543210');              // sends unsubscribe message
await notify.mute('919876543210', 2 * 3600_000);  // mute for 2 hours
await notify.unmute('919876543210');              // unmute immediately
```

STOP / START replies from WhatsApp are handled automatically by the webhook.

---

## Webhooks

### Express

```ts
notify.webhookExpress(app);
// Mounts GET /webhook/whatsapp (verification) and POST /webhook/whatsapp (events)
```

### Fastify

```ts
notify.webhookFastify(app);
```

### Next.js App Router

```ts
// app/api/webhook/whatsapp/route.ts
export async function GET(req) { /* verification */ }
export async function POST(req) {
  const rawBody = await req.text();
  await notify.handleWebhookRequest(rawBody, req.headers.get('x-hub-signature-256'), JSON.parse(rawBody));
  return new Response('OK');
}
```

---

## React / Next.js

### 1. Wrap your app

```tsx
// app/layout.tsx or pages/_app.tsx
import { NotifyProvider } from '@orgname/notify/react';

<NotifyProvider apiBase="/api/notify">
  {children}
</NotifyProvider>
```

### 2. Create the API route

See `apps/web/src/app/api/notify/[action]/route.ts` for the full handler.

### 3. Use hooks in components

```tsx
import { useNotify, useOptIn, useBulkSend } from '@orgname/notify/react';

// Single send
const { send, state } = useNotify();
await send({ to: phone, template: 'task_assigned', data: { ... } });

// Opt-in
const { optIn, optedIn } = useOptIn(phone);
await optIn();

// Bulk
const { sendToRecipients, sent, failed, loading } = useBulkSend();
await sendToRecipients(['9198...', '9191...'], { template: 'alert', data: { ... } });
```

---

## Multi-tenant hosting

For serving many businesses' WhatsApp credentials from one process (rather than one hardcoded `NotifyClient` per deployment), use `TenantClientRegistry`. It resolves and caches a tenant-scoped `NotifyClient` on demand — each cached client has its own `PostgresAdapter` (tenant-scoped queries) and its own `WhatsAppHttpClient` (that tenant's access token baked in at construction), so there's no per-call `tenantId` threading needed anywhere else.

```ts
import { TenantClientRegistry, PostgresAdapter, decryptSecret, parseMasterKey } from '@orgname/notify';

const registry = new TenantClientRegistry({
  pool: pgPool, // shared pg.Pool
  credentialsProvider: {
    async getCredentials(tenantId) {
      const row = await lookUpEncryptedCredentialsFor(tenantId); // your DB query
      return {
        accessToken: decryptSecret(row.accessTokenEnc, tenantId, masterKey, row.keyVersion),
        phoneNumberId: row.phoneNumberId,
        wabaId: row.wabaId,
        verifyToken: row.verifyToken,
        appSecret: row.appSecretEnc ? decryptSecret(row.appSecretEnc, tenantId, masterKey, row.keyVersion) : undefined,
      };
    },
  },
});

const client = await registry.getClient(tenantId);
await client.send({ to: '919876543210', template: 'text', text: 'Hello!' });

// After rotating a tenant's credentials, drop the stale cached client:
registry.invalidate(tenantId);
```

Any feature that needs to react to a tenant's send/delivery/reply events (analytics, outbound webhooks, an AI auto-reply, a CRM sync — anything) should hook in via `onClientReady`, rather than editing `NotifyClient`/`WebhookHandler` themselves:

```ts
const registry = new TenantClientRegistry({
  pool,
  credentialsProvider,
  onClientReady: (client, tenantId) => {
    // Fires once per built client, before it's cached — safe to attach
    // listeners here without guarding against double-registration.
    client.eventBus.on('reply', (reply) => { /* ... */ });
    client.eventBus.on('sent', (event) => { /* ... */ });
  },
});
```

Keep every listener's own side effects wrapped in try/catch — a slow or failing listener (an LLM call, a webhook delivery) must never affect the caller of `send()`, or the webhook route's response to Meta.

### Credential encryption

`CredentialCipher` gives real per-tenant key separation from a single root key via HKDF — no per-tenant key storage, no KMS dependency:

```ts
import { encryptSecret, decryptSecret, parseMasterKey } from '@orgname/notify';

const masterKey = parseMasterKey(process.env.NOTIFY_MASTER_KEY!); // openssl rand -base64 32
const enc = encryptSecret(accessToken, tenantId, masterKey);       // { ciphertext, iv, tag } — store these
const plaintext = decryptSecret(enc, tenantId, masterKey);
```

Root-key rotation is supported via `MasterKeyRing`/`resolveKeyForVersion`/`reEncryptToCurrentVersion` — see `apps/admin/scripts/rotate-master-key.ts` for the full rotation flow (bump `NOTIFY_MASTER_KEY_VERSION`, keep the old key in `NOTIFY_MASTER_KEY_PREVIOUS` during the migration window, re-encrypt every row, then drop the previous key).

### Multi-tenant webhooks

`TenantWebhookRouter` routes one shared Meta callback URL to the correct tenant by peeking `phone_number_id` out of the inbound payload, then verifies the signature against **that tenant's own** `appSecret` (never a globally-configured one) before dispatching:

```ts
import { TenantWebhookRouter } from '@orgname/notify';

const router = new TenantWebhookRouter({
  registry,
  resolveTenantId: (phoneNumberId) => lookUpTenantIdByPhoneNumberId(phoneNumberId), // your DB query
});

const result = await router.handle(rawBodyBuffer, req.headers['x-hub-signature-256'], parsedBody);
res.status(result.status).end(); // 200 handled, 401 bad signature, 404 unknown tenant
```

Signature verification fails **closed**: a missing or invalid signature is always rejected, never silently allowed through.

---

## Storage adapters

| Adapter | Use case | Setup |
|---|---|---|
| `InMemoryAdapter` | Dev / testing | No setup |
| `PostgresAdapter` | Production, single- or multi-tenant | Run `migrations/*.sql` in order (001 is the original single-tenant schema; 002+ add tenants, credentials, media, templates, contacts/campaigns, API keys, audit log, AI config, outbound webhooks, conversations, and contact tags — see [Multi-tenant hosting](#multi-tenant-hosting) and the table below) |

## Queue adapters

| Adapter | Use case | Setup |
|---|---|---|
| `InlineQueueAdapter` | Dev / low-volume | No setup |
| `BullQueueAdapter` | Production / high-volume | Redis |

---

## Running tests

```bash
cd packages/notify
npm test
# or
npm test -- --coverage
```

---

## Project structure

```
packages/notify/
├── src/
│   ├── client/NotifyClient.ts       Main entry point — send, sendBulk, syncTemplates, opt-in/out, webhooks
│   ├── core/
│   │   ├── TemplateEngine.ts        Built-in + custom templates, media attachments, HSM templates
│   │   ├── GuardEngine.ts           Opt-in, quiet hours, mute
│   │   └── EventBus.ts              Lifecycle events
│   ├── adapters/
│   │   ├── queue/                   InlineQueueAdapter, BullQueueAdapter
│   │   └── storage/
│   │       ├── InMemoryAdapter.ts, PostgresAdapter.ts (tenant-scoped)
│   │       └── migrations/          001 (base) → 017 (contact tags) — see table below
│   ├── tenant/TenantClientRegistry.ts  Multi-tenant client resolution + caching; onClientReady extension point
│   ├── security/
│   │   ├── CredentialCipher.ts      Per-tenant encryption, key rotation
│   │   ├── PasswordHash.ts          scrypt-based (also reused for API key hashing)
│   │   ├── SessionCookie.ts         Signed+encrypted admin session cookies
│   │   └── SsrfGuard.ts             isDeliverableUrl() — guards outbound webhook delivery
│   ├── bulk/BulkSender.ts           Bulk + BroadcastList
│   ├── webhook/
│   │   ├── WebhookHandler.ts        Express / Fastify / Next.js (single-tenant)
│   │   ├── TenantWebhookRouter.ts   Multi-tenant webhook routing by phone_number_id
│   │   ├── signature.ts             Shared, fail-closed HMAC verification (inbound + signOutboundWebhookPayload for outbound)
│   │   └── OutboundWebhookDispatcher.ts  deliverSignedWebhook() — SSRF-checked, signed, never throws
│   ├── core/extractBodyPreview.ts   Pulls human-readable preview text from a built payload
│   ├── http/WhatsAppHttpClient.ts   Meta API wrapper — messages, media upload, template listing
│   └── react/index.tsx              NotifyProvider, useNotify, useOptIn, useBulkSend
└── tests/                            NotifyClient.test.ts, SsrfGuard.test.ts, OutboundWebhookDispatcher.test.ts,
                                       signOutboundWebhookPayload.test.ts, extractBodyPreview.test.ts
```

### Migrations

| File | Adds |
|---|---|
| `001_notify.sql` | `notify_log`, `notify_preferences` (original single-tenant schema) |
| `002_tenants.sql` | `tenants`, `admin_users` |
| `003_tenant_wa_credentials.sql` | `tenant_wa_credentials` (encrypted access token/app secret) |
| `004_tenant_scope_existing_tables.sql` | `tenant_id` on `notify_log`/`notify_preferences`, legacy-tenant backfill |
| `005_media_assets.sql` | `media_assets` (per-tenant media library) |
| `006_wa_templates.sql` | `wa_templates` (synced Meta-approved templates) |
| `007_contacts_lists_campaigns.sql` | `contacts`, `broadcast_lists`, `broadcast_list_members`, `campaigns` |
| `008_tenant_api_keys.sql` | `tenant_api_keys` (hashed, prefix-indexed) |
| `009_admin_audit_log.sql` | `admin_audit_log` |
| `010_message_replies.sql` | `message_replies` (persisted inbound replies, queryable independent of the event bus) |
| `011_campaigns_broadcast_id.sql` | `campaigns.broadcast_id` |
| `012_campaigns_header_media.sql` | `campaigns.header_media_type`/`header_media_url` |
| `013_ai_configs.sql` | `ai_configs` (per-tenant BYO AI provider config) + `notify_preferences.ai_reply_count`/`ai_autoreply_disabled`/`ai_handoff_summary` + `claim_ai_reply_slot()` |
| `014_webhook_endpoints.sql` | `webhook_endpoints` (per-tenant outbound event webhook config) |
| `015_notify_log_body_preview.sql` | `notify_log.body_preview` |
| `016_conversations.sql` | `conversations` (`UNIQUE(tenant_id, contact_phone)` from creation) |
| `017_contacts_tags.sql` | `contacts.tags` (`TEXT[]`, GIN-indexed) |

Run them in order against a fresh database; each is additive and idempotent (`CREATE TABLE IF NOT EXISTS`, etc.).
