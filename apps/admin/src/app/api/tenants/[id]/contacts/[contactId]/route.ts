import { NextRequest, NextResponse } from 'next/server';
import { withAdminSession } from '@/lib/auth';
import { getTenant } from '@/lib/tenants';
import { setContactTags, updateContactAttributes } from '@/lib/contacts';

export const PATCH = withAdminSession(
  async (_session, req: NextRequest, ctx: { params: { id: string; contactId: string } }) => {
    const tenant = await getTenant(ctx.params.id);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const body = (await req.json()) as { tags?: string[]; attributes?: Record<string, unknown> };

    let contact = null;
    if (body.tags) {
      contact = await setContactTags(tenant.id, ctx.params.contactId, body.tags);
    }
    if (body.attributes) {
      contact = await updateContactAttributes(tenant.id, ctx.params.contactId, body.attributes);
    }
    if (!contact) return NextResponse.json({ error: 'Contact not found, or nothing to update' }, { status: 404 });

    return NextResponse.json({ contact });
  }
);
