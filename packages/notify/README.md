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

## Storage adapters

| Adapter | Use case | Setup |
|---|---|---|
| `InMemoryAdapter` | Dev / testing | No setup |
| `PostgresAdapter` | Production | Run `migrations/001_notify.sql` |

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
│   ├── client/NotifyClient.ts      Main entry point
│   ├── core/
│   │   ├── TemplateEngine.ts       Built-in + custom templates
│   │   ├── GuardEngine.ts          Opt-in, quiet hours, mute
│   │   └── EventBus.ts             Lifecycle events
│   ├── adapters/
│   │   ├── queue/                  InlineQueueAdapter, BullQueueAdapter
│   │   └── storage/                InMemoryAdapter, PostgresAdapter
│   ├── bulk/BulkSender.ts          Bulk + BroadcastList
│   ├── webhook/WebhookHandler.ts   Express / Fastify / Next.js
│   ├── http/WhatsAppHttpClient.ts  Meta API wrapper
│   └── react/index.tsx             NotifyProvider, useNotify, useOptIn, useBulkSend
├── tests/NotifyClient.test.ts
└── src/adapters/storage/migrations/001_notify.sql
```
