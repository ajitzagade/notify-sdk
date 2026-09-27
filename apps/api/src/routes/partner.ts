import express, { Router, Request, Response, NextFunction } from 'express';
import {
  provisionTenant,
  issueApiKey,
  provisionWebhookEndpoint,
  provisionEmbeddedSignup,
  saveManualCredentials,
  ProvisioningWebhookEvent,
} from '@orgname/notify';
import { requirePartnerKey, PartnerAuthenticatedRequest } from '../lib/partnerKeyAuth';
import { getPool } from '../lib/db';
import { getMasterKeyRing } from '../lib/security';
import { getTenantRegistry } from '../lib/tenantRegistry';

const ALL_WEBHOOK_EVENTS: ProvisioningWebhookEvent[] = ['sent', 'delivered', 'read', 'failed', 'reply'];

const asyncHandler =
  (fn: (req: PartnerAuthenticatedRequest, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req as PartnerAuthenticatedRequest, res).catch(next);
  };

function ctx() {
  return { pool: getPool(), masterKeyRing: getMasterKeyRing() };
}

async function tenantExists(id: string): Promise<boolean> {
  const { rows } = await getPool().query(`SELECT 1 FROM tenants WHERE id = $1 LIMIT 1`, [id]);
  return rows.length > 0;
}

export const partnerRouter = Router();
partnerRouter.use(requirePartnerKey);
partnerRouter.use(express.json());

partnerRouter.post('/tenants', asyncHandler(async (req, res) => {
  const body = req.body as { name?: string; slug?: string; category?: string; autoReplyEnabled?: boolean };
  if (!body.name?.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  const tenant = await provisionTenant(ctx(), { name: body.name.trim(), slug: body.slug, category: body.category });

  if (body.autoReplyEnabled === false) {
    await getPool().query(`UPDATE tenants SET auto_reply_enabled = false WHERE id = $1`, [tenant.id]);
  }

  res.status(201).json({ tenantId: tenant.id, name: tenant.name, slug: tenant.slug, category: tenant.category });
}));

partnerRouter.post('/tenants/:id/api-key', asyncHandler(async (req, res) => {
  if (!(await tenantExists(req.params.id))) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }
  const body = req.body as { label?: string };
  const key = await issueApiKey(ctx(), req.params.id, body.label);
  res.status(201).json({ apiKey: key.fullKey, keyId: key.id, keyPrefix: key.keyPrefix });
}));

partnerRouter.post('/tenants/:id/webhook-endpoints', asyncHandler(async (req, res) => {
  if (!(await tenantExists(req.params.id))) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }
  const body = req.body as { url?: string; events?: ProvisioningWebhookEvent[] };
  if (!body.url) {
    res.status(400).json({ error: 'url is required' });
    return;
  }
  try {
    new URL(body.url);
  } catch {
    res.status(400).json({ error: 'url must be a valid absolute URL' });
    return;
  }
  const events = (body.events ?? []).filter((e) => ALL_WEBHOOK_EVENTS.includes(e));
  if (events.length === 0) {
    res.status(400).json({ error: 'events must include at least one of sent, delivered, read, failed, reply' });
    return;
  }

  const endpoint = await provisionWebhookEndpoint(ctx(), { tenantId: req.params.id, url: body.url, events });
  res.status(201).json({ endpointId: endpoint.id, secret: endpoint.secret });
}));

partnerRouter.post('/tenants/:id/credentials', asyncHandler(async (req, res) => {
  if (!(await tenantExists(req.params.id))) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }
  const body = req.body as {
    accessToken?: string; phoneNumberId?: string; wabaId?: string; appSecret?: string; verifyToken?: string;
  };
  if (!body.accessToken || !body.phoneNumberId) {
    res.status(400).json({ error: 'accessToken and phoneNumberId are required' });
    return;
  }

  const result = await saveManualCredentials(ctx(), req.params.id, {
    accessToken: body.accessToken, phoneNumberId: body.phoneNumberId,
    wabaId: body.wabaId, appSecret: body.appSecret, verifyToken: body.verifyToken,
  });

  if (!result.ok) {
    res.status(result.statusCode).json({ error: result.error });
    return;
  }
  getTenantRegistry().invalidate(req.params.id);
  res.json({
    ok: true, verifiedName: result.displayName, displayPhoneNumber: result.displayPhoneNumber,
    verifyToken: result.verifyToken, webhookWarning: result.webhookWarning,
  });
}));

partnerRouter.post('/tenants/:id/embedded-signup', asyncHandler(async (req, res) => {
  if (!(await tenantExists(req.params.id))) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    res.status(503).json({ error: 'Embedded Signup is not enabled on this deployment' });
    return;
  }

  const body = req.body as { code?: string; wabaId?: string; phoneNumberId?: string };
  if (!body.code || !body.wabaId || !body.phoneNumberId) {
    res.status(400).json({ error: 'code, wabaId, and phoneNumberId are required' });
    return;
  }

  // The OAuth code expires in ~30s — exchanged immediately below; retrying
  // this call on a transient failure is safe (the write is an upsert).
  const result = await provisionEmbeddedSignup(
    ctx(), req.params.id,
    { code: body.code, wabaId: body.wabaId, phoneNumberId: body.phoneNumberId },
    { appId, appSecret }
  );

  if (!result.ok) {
    res.status(result.statusCode).json({ error: result.error });
    return;
  }
  getTenantRegistry().invalidate(req.params.id);
  res.json({ ok: true, displayName: result.displayName, displayPhoneNumber: result.displayPhoneNumber });
}));

partnerRouter.get('/tenants/:id/status', asyncHandler(async (req, res) => {
  const { rows: tenantRows } = await getPool().query(
    `SELECT id, name, slug, category, auto_reply_enabled FROM tenants WHERE id = $1 LIMIT 1`,
    [req.params.id]
  );
  if (!tenantRows[0]) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }

  const { rows: credRows } = await getPool().query(
    `SELECT phone_number_id, waba_id, onboarding_method, last_verified_at, last_verified_status
       FROM tenant_wa_credentials WHERE tenant_id = $1 LIMIT 1`,
    [req.params.id]
  );
  const { rows: templateRows } = await getPool().query(
    `SELECT name, language, status FROM wa_templates WHERE tenant_id = $1 ORDER BY name`,
    [req.params.id]
  );

  const t = tenantRows[0];
  const c = credRows[0];
  res.json({
    tenantId: t.id, name: t.name, slug: t.slug, category: t.category,
    autoReplyEnabled: t.auto_reply_enabled,
    connection: c
      ? {
          configured: true,
          phoneNumberId: c.phone_number_id,
          wabaId: c.waba_id,
          onboardingMethod: c.onboarding_method,
          lastVerifiedAt: c.last_verified_at,
          lastVerifiedStatus: c.last_verified_status,
        }
      : { configured: false },
    templates: templateRows.map((r) => ({ name: r.name, language: r.language, status: r.status })),
  });
}));
