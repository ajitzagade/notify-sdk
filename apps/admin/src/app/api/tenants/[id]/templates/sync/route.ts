import { NextRequest, NextResponse } from 'next/server';
import { withAdminSession } from '@/lib/auth';
import { getTenant, getCredentialStatus } from '@/lib/tenants';
import { upsertTemplates, listTemplates } from '@/lib/templates';
import { getTenantRegistry } from '@/lib/tenantRegistry';

export const POST = withAdminSession(async (_session, _req: NextRequest, ctx: { params: { id: string } }) => {
  const tenant = await getTenant(ctx.params.id);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const status = await getCredentialStatus(tenant.id);
  if (!status.configured) {
    return NextResponse.json({ error: 'No WhatsApp credentials configured for this tenant yet' }, { status: 400 });
  }
  if (!status.wabaId) {
    return NextResponse.json(
      { error: 'This tenant has no WhatsApp Business Account ID configured — add one on the Credentials panel to sync templates' },
      { status: 400 }
    );
  }

  try {
    const client = await getTenantRegistry().getClient(tenant.id);
    const metaTemplates = await client.syncTemplates();
    await upsertTemplates(tenant.id, metaTemplates);
    const templates = await listTemplates(tenant.id);
    return NextResponse.json({ ok: true, count: templates.length, templates });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
});
