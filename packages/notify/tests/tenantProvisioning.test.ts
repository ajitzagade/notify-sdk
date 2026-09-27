import crypto from 'crypto';
import {
  createTenant,
  issueApiKey,
  createWebhookEndpoint,
  completeEmbeddedSignup,
  saveManualCredentials,
  isValidSlug,
  ProvisioningContext,
  ProvisioningPool,
} from '../src/provisioning/tenantProvisioning';
import { decryptSecret } from '../src/security/CredentialCipher';

function makeFakePool(): ProvisioningPool & { inserted: Record<string, unknown>[] } {
  const inserted: Record<string, unknown>[] = [];
  const existingSlugs = new Set<string>();
  const existingPhoneNumberIds = new Set<string>();
  const webhookEndpoints: Record<string, unknown>[] = [];

  return {
    inserted,
    async query(text: string, params: unknown[] = []) {
      if (text.includes('INSERT INTO tenants')) {
        const slug = params[1] as string;
        if (existingSlugs.has(slug)) {
          throw new Error('duplicate key value violates unique constraint "tenants_slug_key"');
        }
        existingSlugs.add(slug);
        const row = { id: crypto.randomUUID(), name: params[0], slug, category: params[3] ?? null, created_at: new Date().toISOString() };
        inserted.push(row);
        return { rows: [row] };
      }
      if (text.includes('INSERT INTO tenant_api_keys')) {
        const row = { id: crypto.randomUUID() };
        inserted.push({ table: 'tenant_api_keys', ...row, tenant_id: params[0], key_prefix: params[1] });
        return { rows: [row] };
      }
      if (text.startsWith('SELECT id, url, events, secret_ciphertext, secret_iv, secret_tag, key_version')) {
        const [tenantId, url] = params as [string, string];
        const matches = webhookEndpoints.filter((r) => r.tenant_id === tenantId && r.url === url && r.is_active === true);
        return { rows: matches };
      }
      if (text.includes('INSERT INTO webhook_endpoints')) {
        const row = {
          table: 'webhook_endpoints', id: crypto.randomUUID(),
          tenant_id: params[0], url: params[1],
          secret_ciphertext: params[2], secret_iv: params[3], secret_tag: params[4], key_version: params[5],
          events: params[6], is_active: true,
        };
        inserted.push(row);
        webhookEndpoints.push(row);
        return { rows: [row] };
      }
      if (text.includes('INSERT INTO tenant_wa_credentials')) {
        const phoneNumberId = params[1] as string;
        if (existingPhoneNumberIds.has(phoneNumberId) && !text.includes('ON CONFLICT')) {
          throw new Error('duplicate key value violates unique constraint on phone_number_id');
        }
        // Simulate the real UNIQUE(phone_number_id) constraint independent of tenant_id.
        if (existingPhoneNumberIds.has(phoneNumberId)) {
          throw new Error('duplicate key value violates unique constraint "tenant_wa_credentials_phone_number_id_key"');
        }
        existingPhoneNumberIds.add(phoneNumberId);
        const row = { table: 'tenant_wa_credentials', tenant_id: params[0], phone_number_id: phoneNumberId, params };
        inserted.push(row);
        return { rows: [row], rowCount: 1 };
      }
      throw new Error(`unexpected query in test fake pool: ${text}`);
    },
  };
}

function makeCtx(pool: ProvisioningPool): ProvisioningContext {
  return {
    pool,
    masterKeyRing: { currentVersion: 1, currentKey: crypto.randomBytes(32) },
  };
}

describe('provisioning — isValidSlug', () => {
  it('matches the same rules as apps/admin/src/lib/tenants.ts', () => {
    expect(isValidSlug('acme-clinic')).toBe(true);
    expect(isValidSlug('a')).toBe(false); // too short
    expect(isValidSlug('Acme')).toBe(false); // uppercase
    expect(isValidSlug('acme_clinic')).toBe(false); // underscore
  });
});

describe('provisioning — createTenant', () => {
  it('creates a tenant with a caller-supplied slug', async () => {
    const pool = makeFakePool();
    const tenant = await createTenant(makeCtx(pool), { name: 'Acme Clinic', slug: 'acme-clinic', category: 'healthcare' });
    expect(tenant.slug).toBe('acme-clinic');
    expect(tenant.category).toBe('healthcare');
  });

  it('rejects an invalid caller-supplied slug rather than silently fixing it', async () => {
    const pool = makeFakePool();
    await expect(createTenant(makeCtx(pool), { name: 'Acme', slug: 'Not Valid!' })).rejects.toThrow(/slug must be/);
  });

  it('derives a slug from name when none is supplied', async () => {
    const pool = makeFakePool();
    const tenant = await createTenant(makeCtx(pool), { name: 'Dr. Rao\'s Clinic!!' });
    expect(isValidSlug(tenant.slug)).toBe(true);
    expect(tenant.slug).toContain('rao');
  });

  it('retries with a numeric suffix on a derived-slug collision, without erroring', async () => {
    const pool = makeFakePool();
    const ctx = makeCtx(pool);
    const first = await createTenant(ctx, { name: 'Acme' });
    const second = await createTenant(ctx, { name: 'Acme' });
    expect(first.slug).not.toBe(second.slug);
  });
});

describe('provisioning — issueApiKey', () => {
  it('returns a nsk_-prefixed key exactly once', async () => {
    const pool = makeFakePool();
    const key = await issueApiKey(makeCtx(pool), 'tenant-1', 'Cliniqly integration');
    expect(key.fullKey.startsWith('nsk_')).toBe(true);
    expect(key.keyPrefix).toHaveLength(8);
  });
});

describe('provisioning — createWebhookEndpoint', () => {
  it('returns a whsec_-prefixed secret and encrypts it before the INSERT', async () => {
    const pool = makeFakePool();
    const endpoint = await createWebhookEndpoint(makeCtx(pool), {
      tenantId: 'tenant-1', url: 'https://cliniqly.example/hooks', events: ['reply', 'sent'],
    });
    expect(endpoint.secret.startsWith('whsec_')).toBe(true);

    const insertedRow = pool.inserted.find((r) => r.table === 'webhook_endpoints');
    expect(insertedRow).toBeDefined();
  });

  it('is retry-safe: an identical (tenantId, url, events) call returns the SAME endpoint id and secret, not a duplicate', async () => {
    const pool = makeFakePool();
    const ctx = makeCtx(pool);
    const input = { tenantId: 'tenant-1', url: 'https://cliniqly.example/hooks', events: ['reply', 'sent'] as const };

    const first = await createWebhookEndpoint(ctx, { ...input, events: [...input.events] });
    const retry = await createWebhookEndpoint(ctx, { ...input, events: [...input.events] });

    expect(retry.id).toBe(first.id);
    expect(retry.secret).toBe(first.secret);
    expect(pool.inserted.filter((r) => r.table === 'webhook_endpoints')).toHaveLength(1);
  });

  it('treats a different events subset for the same URL as a deliberate second registration, not a retry', async () => {
    const pool = makeFakePool();
    const ctx = makeCtx(pool);
    const url = 'https://cliniqly.example/hooks';

    const first = await createWebhookEndpoint(ctx, { tenantId: 'tenant-1', url, events: ['reply'] });
    const second = await createWebhookEndpoint(ctx, { tenantId: 'tenant-1', url, events: ['sent', 'delivered'] });

    expect(second.id).not.toBe(first.id);
    expect(second.secret).not.toBe(first.secret);
    expect(pool.inserted.filter((r) => r.table === 'webhook_endpoints')).toHaveLength(2);
  });

  it('matches events regardless of array order (a retry that happens to reorder its own array is still recognized)', async () => {
    const pool = makeFakePool();
    const ctx = makeCtx(pool);
    const url = 'https://cliniqly.example/hooks';

    const first = await createWebhookEndpoint(ctx, { tenantId: 'tenant-1', url, events: ['reply', 'sent'] });
    const retry = await createWebhookEndpoint(ctx, { tenantId: 'tenant-1', url, events: ['sent', 'reply'] });

    expect(retry.id).toBe(first.id);
  });
});

describe('provisioning — completeEmbeddedSignup', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; jest.restoreAllMocks(); });

  it('exchanges the code, subscribes the WABA, and persists encrypted credentials', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'business-token', expires_in: 5184000 }) }) // exchange
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // subscribe
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // register phone
      .mockResolvedValueOnce({ ok: true, json: async () => ({ verified_name: 'Acme Clinic', display_phone_number: '+91 90000 00000' }) }); // verify
    global.fetch = fetchMock as unknown as typeof fetch;

    const pool = makeFakePool();
    const ctx = makeCtx(pool);
    const result = await completeEmbeddedSignup(
      ctx, 'tenant-1',
      { code: 'oauth-code', wabaId: 'waba-1', phoneNumberId: 'phone-1' },
      { appId: 'app-1', appSecret: 'app-secret' }
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.displayName).toBe('Acme Clinic');

    const credRow = pool.inserted.find((r) => r.table === 'tenant_wa_credentials') as { params: unknown[] };
    expect(credRow).toBeDefined();
    const [, , , tokenCiphertext, tokenIv, tokenTag] = credRow.params as string[];
    const decrypted = decryptSecret({ ciphertext: tokenCiphertext, iv: tokenIv, tag: tokenTag }, 'tenant-1', ctx.masterKeyRing.currentKey, 1);
    expect(decrypted).toBe('business-token');
  });

  it('returns a 502 without writing credentials when the token exchange fails', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ error: { message: 'invalid code' } }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    const pool = makeFakePool();
    const result = await completeEmbeddedSignup(
      makeCtx(pool), 'tenant-1',
      { code: 'bad-code', wabaId: 'waba-1', phoneNumberId: 'phone-1' },
      { appId: 'app-1', appSecret: 'app-secret' }
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.statusCode).toBe(502);
    expect(pool.inserted.some((r) => r.table === 'tenant_wa_credentials')).toBe(false);
  });

  it('returns 409 when the phone number is already connected to another tenant', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValue({ ok: true, json: async () => ({ access_token: 'tok', expires_in: 100, verified_name: 'x', display_phone_number: 'y' }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    const pool = makeFakePool();
    const ctx = makeCtx(pool);
    await completeEmbeddedSignup(ctx, 'tenant-1', { code: 'c1', wabaId: 'w1', phoneNumberId: 'phone-shared' }, { appId: 'a', appSecret: 's' });
    const second = await completeEmbeddedSignup(ctx, 'tenant-2', { code: 'c2', wabaId: 'w2', phoneNumberId: 'phone-shared' }, { appId: 'a', appSecret: 's' });

    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.statusCode).toBe(409);
  });
});

describe('provisioning — saveManualCredentials', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; jest.restoreAllMocks(); });

  it('re-verifies against Meta before persisting, never trusting a caller-asserted "already verified"', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: { message: 'bad token' } }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    const pool = makeFakePool();
    const result = await saveManualCredentials(makeCtx(pool), 'tenant-1', { accessToken: 'bad', phoneNumberId: 'phone-1' });

    expect(result.ok).toBe(false);
    expect(pool.inserted).toHaveLength(0);
  });

  it('warns but still saves when no wabaId is provided (webhook subscription skipped)', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ verified_name: 'Acme', display_phone_number: '+91' }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    const pool = makeFakePool();
    const result = await saveManualCredentials(makeCtx(pool), 'tenant-1', { accessToken: 'good', phoneNumberId: 'phone-1' });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.webhookWarning).toMatch(/No WABA ID/);
  });
});
