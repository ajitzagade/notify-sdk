import { NextRequest, NextResponse } from 'next/server';
import { MediaAttachment, HsmComponent } from '@orgname/notify';
import { withPortalSession } from '@/lib/tenantPortalAuth';
import { getTenant, getCredentialStatus } from '@/lib/tenants';
import { getTenantRegistry } from '@/lib/tenantRegistry';
import { normalizePhone } from '@/lib/phone';
import { getHsmBodyPreview } from '@/lib/hsmPreview';

/** Portal twin of POST /api/tenants/[id]/test-send — tenant from the session cookie only. */
export const POST = withPortalSession(async (session, req: NextRequest) => {
  const tenant = await getTenant(session.tenantId);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const status = await getCredentialStatus(tenant.id);
  if (!status.configured) {
    return NextResponse.json({ error: 'WhatsApp is not connected yet — connect it from Settings first' }, { status: 400 });
  }

  const body = (await req.json()) as {
    phone?: string;
    message?: string;
    attachment?: MediaAttachment;
    hsmTemplate?: { name: string; language: string; components?: HsmComponent[] };
  };
  const phone = body.phone?.trim() ? normalizePhone(body.phone.trim()) : '';
  if (!phone) {
    return NextResponse.json({ error: 'phone is required' }, { status: 400 });
  }
  if (body.attachment && !body.attachment.link && !body.attachment.id) {
    return NextResponse.json({ error: 'attachment requires a link' }, { status: 400 });
  }
  if (body.hsmTemplate && !body.hsmTemplate.name) {
    return NextResponse.json({ error: 'hsmTemplate requires a name' }, { status: 400 });
  }

  try {
    const client = await getTenantRegistry().getClient(tenant.id);
    await client.optIn(phone); // required so GuardEngine allows the send below
    const bodyPreview = body.hsmTemplate
      ? await getHsmBodyPreview(tenant.id, body.hsmTemplate.name, body.hsmTemplate.language, body.hsmTemplate.components)
      : undefined;
    const event = await client.send({
      to:          phone,
      template:    'text',
      text:        body.message?.trim() || `Test message from ${tenant.name} via the tenant portal.`,
      attachment:  body.attachment,
      hsmTemplate: body.hsmTemplate,
      bodyPreview,
      priority:    'high',
    });
    return NextResponse.json({ ok: event.status !== 'failed', event });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
});
