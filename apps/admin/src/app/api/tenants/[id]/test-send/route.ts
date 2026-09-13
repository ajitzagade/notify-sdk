import { NextRequest, NextResponse } from 'next/server';
import { MediaAttachment, HsmComponent } from '@orgname/notify';
import { withAdminSession } from '@/lib/auth';
import { getTenant, getCredentialStatus } from '@/lib/tenants';
import { getTenantRegistry } from '@/lib/tenantRegistry';
import { normalizePhone } from '@/lib/phone';

/**
 * Sends a real text message through the tenant's own WhatsApp number — the
 * end-to-end proof that onboarding worked: resolves this tenant's credentials,
 * decrypts them, calls Meta, and logs the result into this tenant's own
 * tenant-scoped notify_log row (client.send() logs; client.optIn() alone does
 * not, so opt-in is a separate first step purely to satisfy GuardEngine).
 */
export const POST = withAdminSession(async (_session, req: NextRequest, ctx: { params: { id: string } }) => {
  const tenant = await getTenant(ctx.params.id);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const status = await getCredentialStatus(tenant.id);
  if (!status.configured) {
    return NextResponse.json({ error: 'No WhatsApp credentials configured for this tenant yet' }, { status: 400 });
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
    const event = await client.send({
      to:          phone,
      template:    'text',
      text:        body.message?.trim() || `Test message from ${tenant.name} via @orgname/notify admin.`,
      attachment:  body.attachment,
      hsmTemplate: body.hsmTemplate,
      priority:    'high',
    });
    return NextResponse.json({ ok: event.status !== 'failed', event });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
});
