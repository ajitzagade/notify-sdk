import { NextResponse } from 'next/server';
import { withPortalSession } from '@/lib/tenantPortalAuth';
import { getCredentialStatus } from '@/lib/tenants';
import { upsertTemplates, listTemplates } from '@/lib/templates';
import { getTenantRegistry } from '@/lib/tenantRegistry';

export const POST = withPortalSession(async (session) => {
  const status = await getCredentialStatus(session.tenantId);
  if (!status.configured) {
    return NextResponse.json({ error: 'No WhatsApp credentials configured for this tenant yet' }, { status: 400 });
  }
  if (!status.wabaId) {
    return NextResponse.json(
      { error: 'This tenant has no WhatsApp Business Account ID configured — contact your ops team to add one' },
      { status: 400 }
    );
  }

  try {
    const client = await getTenantRegistry().getClient(session.tenantId);
    const metaTemplates = await client.syncTemplates();
    await upsertTemplates(session.tenantId, metaTemplates);
    const templates = await listTemplates(session.tenantId);
    return NextResponse.json({ ok: true, count: templates.length, templates });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
});
