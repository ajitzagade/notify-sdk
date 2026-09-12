import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import {
  NotifyClient,
  InlineQueueAdapter,
  InMemoryAdapter,
} from '@orgname/notify';
import { app } from './app';

// Express 4 doesn't forward rejected promises from async handlers to error
// middleware, so an unhandled rejection would otherwise crash the process.
const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

// ── 1. Initialise the client (minimal — no Redis, no DB needed for local dev) ─
const notify = new NotifyClient({
  accessToken:   process.env.WA_ACCESS_TOKEN   ?? 'YOUR_ACCESS_TOKEN',
  phoneNumberId: process.env.WA_PHONE_NUMBER_ID ?? 'YOUR_PHONE_NUMBER_ID',
  verifyToken:   process.env.WA_VERIFY_TOKEN   ?? 'my_verify_token_123',
  appSecret:     process.env.WA_APP_SECRET,

  // Swap InlineQueueAdapter → BullQueueAdapter(redisUrl) for production
  queue:   new InlineQueueAdapter(),
  // Swap InMemoryAdapter → PostgresAdapter(pool) for production
  storage: new InMemoryAdapter(),

  defaults: {
    timezone:   'Asia/Kolkata',
    quietHours: { start: 22, end: 8 },
  },

  onSent:    (e)      => console.log('✓ Sent:', e.template, '→', e.to, e.waMessageId),
  onFailed:  (e, err) => console.error('✗ Failed:', e.to, err.message),
  onReply:   (reply)  => {
    console.log('↩ Reply from', reply.from, ':', reply.buttonTitle ?? reply.text);

    // Example: handle task action buttons
    if (reply.type === 'button' && reply.buttonId) {
      const [action, taskId] = reply.buttonId.split('_');
      console.log(`Action "${action}" on task ${taskId}`);
      // → call your task service here: taskService.updateStatus(taskId, action)
    }
  },
});

// ── 2. Register a custom template ──────────────────────────────────────────
notify.registerTemplate('deploy_alert', (data) => ({
  type: 'interactive',
  interactive: {
    type: 'button',
    header: { type: 'text', text: `${data.status === 'success' ? 'Deploy successful' : 'Deploy failed'}` },
    body: {
      text:
        `*${data.service}* v${data.version}\n\n` +
        `Environment: ${data.env}\n` +
        `Triggered by: ${data.triggeredBy}\n` +
        `Duration: ${data.duration}s`,
    },
    action: {
      buttons: [
        { type: 'reply', reply: { id: `view_${data.deployId}`,   title: 'View logs'   } },
        { type: 'reply', reply: { id: `rb_${data.deployId}`,     title: 'Rollback'    } },
      ],
    },
  },
}));

// ── 3. Define broadcast lists ──────────────────────────────────────────────
notify.broadcastLists
  .define({ name: 'engineering', phones: [] })
  .define({ name: 'all-hands',   phones: [] });

// ── 4. Mount the demo webhook onto the shared app (helmet + /v1 already on it,
// see src/app.ts) ───────────────────────────────────────────────────────────
//
// Runs BEFORE any generic JSON body-parser: it needs the raw body for HMAC
// signature verification via its own express.json({verify}) middleware, and
// body-parser silently no-ops on a second parse attempt once something
// upstream already consumed the body — mounting a global express.json()
// first (as this used to do) meant the verify callback below never actually
// fired, so req.rawBody was always empty and real Meta signatures could
// never validate.
notify.webhookExpress(app);       // single-tenant demo webhook (GET/POST /webhook/whatsapp)

app.use(express.json());

// ── 5. Routes that demonstrate every use case ──────────────────────────────

/** POST /demo/opt-in  { phone: "919876543210" } */
app.post('/demo/opt-in', asyncHandler(async (req, res) => {
  const { phone } = req.body as { phone: string };
  await notify.optIn(phone);
  res.json({ ok: true, message: `Opt-in confirmation sent to ${phone}` });
}));

/** POST /demo/single  { phone, template, data } */
app.post('/demo/single', asyncHandler(async (req, res) => {
  const { phone, template, data } = req.body as {
    phone: string; template: string; data: Record<string, unknown>;
  };
  const event = await notify.send({ to: phone, template, data });
  res.json(event);
}));

/** POST /demo/otp  { phone } */
app.post('/demo/otp', asyncHandler(async (req, res) => {
  const { phone } = req.body as { phone: string };
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const event = await notify.send({
    to:       phone,
    template: 'otp',
    data:     { code, expiresIn: '5 minutes' },
    priority: 'high',
    tags:     ['auth', 'otp'],
  });
  res.json({ event, code }); // don't expose code in real app!
}));

/** POST /demo/task-assigned  { phone, taskId, title, priority, dueDate, assignedBy } */
app.post('/demo/task-assigned', asyncHandler(async (req, res) => {
  const event = await notify.send({
    to:       req.body.phone as string,
    template: 'task_assigned',
    data:     req.body,
    tags:     ['tasks'],
    meta:     { taskId: req.body.taskId as string },
  });
  res.json(event);
}));

/** POST /demo/approval  { managerPhone, title, requestedBy, details, refId } */
app.post('/demo/approval', asyncHandler(async (req, res) => {
  const event = await notify.send({
    to:       req.body.managerPhone as string,
    template: 'approval_request',
    data:     req.body,
    tags:     ['hr', 'approval'],
  });
  res.json(event);
}));

/** POST /demo/deploy  { phone, service, version, env, status, triggeredBy, duration, deployId } */
app.post('/demo/deploy', asyncHandler(async (req, res) => {
  const event = await notify.send({
    to:       req.body.phone as string,
    template: 'deploy_alert',
    data:     req.body,
    priority: 'high',
    tags:     ['devops', 'deploy'],
  });
  res.json(event);
}));

/** POST /demo/bulk  { phones: [...], template, data } */
app.post('/demo/bulk', asyncHandler(async (req, res) => {
  const { phones, template, data } = req.body as {
    phones: string[]; template: string; data: Record<string, unknown>;
  };
  const result = await notify.sendBulk({
    recipients: phones,
    template,
    data,
    batchSize:             10,
    delayBetweenBatchesMs: 500,
    onProgress: (p) => console.log(`Bulk progress: ${p.percent}% (${p.sent}/${p.total})`),
  });
  res.json(result);
}));

/** POST /demo/scheduled  { phone, template, data, scheduleAt (ISO string) } */
app.post('/demo/scheduled', asyncHandler(async (req, res) => {
  const event = await notify.send({
    to:         req.body.phone as string,
    template:   req.body.template as string,
    data:       req.body.data as Record<string, unknown>,
    scheduleAt: new Date(req.body.scheduleAt as string),
    tags:       ['scheduled'],
  });
  res.json(event);
}));

/** GET /demo/logs — view recent notification log */
app.get('/demo/logs', asyncHandler(async (_req, res) => {
  const events = await notify.getRecentEvents(20);
  res.json(events);
}));

// ── Error handler ────────────────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('✗ Request failed:', err.message);
  res.status(502).json({ error: err.message });
});

// ── Start ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`\n@orgname/notify — Express demo running on http://localhost:${PORT}`);
  console.log('\nAvailable endpoints:');
  console.log('  POST /demo/opt-in');
  console.log('  POST /demo/single');
  console.log('  POST /demo/otp');
  console.log('  POST /demo/task-assigned');
  console.log('  POST /demo/approval');
  console.log('  POST /demo/deploy');
  console.log('  POST /demo/bulk');
  console.log('  POST /demo/scheduled');
  console.log('  GET  /demo/logs');
  console.log('  GET  /webhook/whatsapp  (verification)');
  console.log('  POST /webhook/whatsapp  (events)');
  console.log('\nMulti-tenant API (Authorization: Bearer <tenant api key>):');
  console.log('  POST /v1/send');
  console.log('  POST /v1/send-bulk');
  console.log('  POST /v1/opt-in');
  console.log('  POST /v1/opt-out');
  console.log('  GET  /v1/logs');
  console.log('  GET  /v1/webhook/whatsapp  (verification)');
  console.log('  POST /v1/webhook/whatsapp  (events)\n');
});
