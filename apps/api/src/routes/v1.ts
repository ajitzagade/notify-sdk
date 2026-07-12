import express, { Router, Request, Response, NextFunction } from 'express';
import { TenantWebhookRouter, MediaAttachment, HsmComponent } from '@orgname/notify';
import { requireApiKey, AuthenticatedRequest } from '../lib/apiKeyAuth';
import { getTenantRegistry } from '../lib/tenantRegistry';
import { resolveTenantIdByPhoneNumberId } from '../lib/webhookTenantResolver';

const asyncHandler =
  (fn: (req: AuthenticatedRequest, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req as AuthenticatedRequest, res).catch(next);
  };

// Per-tenant in-memory rate limit — sufficient for a single-instance deployment
// (see apps/admin/src/lib/rateLimit.ts for the same pattern used on login).
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT  = 60;
const WINDOW_MS   = 60 * 1000;

function rateLimit(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const key   = req.tenantId as string;
  const now   = Date.now();
  const entry = requestCounts.get(key);

  if (!entry || entry.resetAt < now) {
    requestCounts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    next();
    return;
  }
  if (entry.count >= RATE_LIMIT) {
    res.status(429).json({ error: 'Rate limit exceeded — max 60 requests/minute per tenant' });
    return;
  }
  entry.count += 1;
  next();
}

export const v1Router = Router();

// Server-to-server API — the API key is the real auth boundary, not CORS.
v1Router.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

// ── Webhook (Meta → us) — mounted before any generic JSON parser or the
// requireApiKey gate, since it's authenticated by Meta's own signature/token,
// not a tenant API key, and needs the RAW body for HMAC verification. ──────

const tenantWebhookRouter = new TenantWebhookRouter({
  registry:        getTenantRegistry(),
  resolveTenantId: resolveTenantIdByPhoneNumberId,
});

/**
 * Meta's GET verification handshake has no payload — just hub.mode/
 * hub.verify_token/hub.challenge — so there's no tenant to resolve it
 * against. This is inherent to a single shared callback URL for the whole
 * platform: every tenant's Meta App webhook config must point here using
 * this ONE platform-level token (PLATFORM_WEBHOOK_VERIFY_TOKEN), not the
 * per-tenant verify_token stored on tenant_wa_credentials (that field only
 * matters if a tenant is ever given their own dedicated callback URL).
 */
v1Router.get('/webhook/whatsapp', (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
  if (mode === 'subscribe' && token === process.env.PLATFORM_WEBHOOK_VERIFY_TOKEN) {
    res.send(challenge);
  } else {
    res.sendStatus(403);
  }
});

v1Router.post(
  '/webhook/whatsapp',
  express.json({
    verify: (req: express.Request & { rawBody?: Buffer }, _res, buf) => {
      req.rawBody = buf;
    },
  }),
  asyncHandler(async (req: AuthenticatedRequest & { rawBody?: Buffer }, res) => {
    const signature = (req.headers['x-hub-signature-256'] as string) ?? '';
    const result = await tenantWebhookRouter.handle(req.rawBody ?? Buffer.from(''), signature, req.body);
    res.status(result.status).end();
  })
);

// ── Everything below requires a tenant API key ──────────────────────────────

v1Router.use(express.json());
v1Router.use(requireApiKey);
v1Router.use(rateLimit);

v1Router.post('/send', asyncHandler(async (req, res) => {
  const body = req.body as {
    to?: string; template?: string; data?: Record<string, unknown>; text?: string;
    buttons?: string[]; attachment?: MediaAttachment;
    hsmTemplate?: { name: string; language: string; components?: HsmComponent[] };
    priority?: 'low' | 'normal' | 'high'; scheduleAt?: string;
    tags?: string[]; meta?: Record<string, unknown>;
  };
  if (!body.to || !body.template) {
    res.status(400).json({ error: 'to and template are required' });
    return;
  }

  const client = await getTenantRegistry().getClient(req.tenantId as string);
  const event = await client.send({
    to:          body.to,
    template:    body.template,
    data:        body.data,
    text:        body.text,
    buttons:     body.buttons,
    attachment:  body.attachment,
    hsmTemplate: body.hsmTemplate,
    priority:    body.priority,
    scheduleAt:  body.scheduleAt ? new Date(body.scheduleAt) : undefined,
    tags:        body.tags,
    meta:        body.meta,
  });
  res.json(event);
}));

v1Router.post('/send-bulk', asyncHandler(async (req, res) => {
  const body = req.body as {
    recipients?: string[]; template?: string; data?: Record<string, unknown>; batchSize?: number;
  };
  if (!body.recipients?.length || !body.template) {
    res.status(400).json({ error: 'recipients and template are required' });
    return;
  }

  const client = await getTenantRegistry().getClient(req.tenantId as string);
  const result = await client.sendBulk({
    recipients: body.recipients,
    template:   body.template,
    data:       body.data,
    batchSize:  body.batchSize ?? 50,
  });
  res.json(result);
}));

v1Router.post('/opt-in', asyncHandler(async (req, res) => {
  const { phone } = req.body as { phone?: string };
  if (!phone) { res.status(400).json({ error: 'phone is required' }); return; }
  const client = await getTenantRegistry().getClient(req.tenantId as string);
  await client.optIn(phone);
  res.json({ ok: true });
}));

v1Router.post('/opt-out', asyncHandler(async (req, res) => {
  const { phone } = req.body as { phone?: string };
  if (!phone) { res.status(400).json({ error: 'phone is required' }); return; }
  const client = await getTenantRegistry().getClient(req.tenantId as string);
  await client.optOut(phone);
  res.json({ ok: true });
}));

v1Router.get('/logs', asyncHandler(async (req, res) => {
  const client = await getTenantRegistry().getClient(req.tenantId as string);
  const events = await client.getRecentEvents(50);
  res.json(events);
}));

// ── Error handler — scoped to this router, mirrors the app-level one in
// index.ts so a rejected promise here 502s instead of crashing the process.
v1Router.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('✗ /v1 request failed:', err.message);
  res.status(502).json({ error: err.message });
});
