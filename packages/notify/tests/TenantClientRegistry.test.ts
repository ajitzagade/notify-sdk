import { TenantClientRegistry, TenantCredentialsProvider } from '../src/tenant/TenantClientRegistry';

const credentialsProvider: TenantCredentialsProvider = {
  getCredentials: async () => ({
    accessToken: 'token',
    phoneNumberId: 'phone_1',
    verifyToken: 'verify',
  }),
};

describe('TenantClientRegistry — onClientReady', () => {
  it('supports a synchronous onClientReady (backward compatible)', async () => {
    const seen: string[] = [];
    const registry = new TenantClientRegistry({
      credentialsProvider,
      pool: {},
      onClientReady: (_client, tenantId) => { seen.push(tenantId); },
    });

    await registry.getClient('tenant-a');
    expect(seen).toEqual(['tenant-a']);
  });

  it('awaits an async onClientReady before caching/returning the client', async () => {
    let sideEffectDone = false;
    const registry = new TenantClientRegistry({
      credentialsProvider,
      pool: {},
      onClientReady: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        sideEffectDone = true;
      },
    });

    await registry.getClient('tenant-b');
    // If onClientReady weren't awaited, getClient() would have resolved
    // before the 10ms timeout fired and this would be false.
    expect(sideEffectDone).toBe(true);
  });

  it('propagates a rejected onClientReady instead of silently caching a half-built client', async () => {
    const registry = new TenantClientRegistry({
      credentialsProvider,
      pool: {},
      onClientReady: async () => { throw new Error('setup failed'); },
    });

    await expect(registry.getClient('tenant-c')).rejects.toThrow('setup failed');
  });
});
