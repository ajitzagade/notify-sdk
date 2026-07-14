import { NextRequest, NextResponse } from 'next/server';
import { withPortalSession } from '@/lib/tenantPortalAuth';
import { setContactTags, updateContactAttributes } from '@/lib/contacts';

export const PATCH = withPortalSession(
  async (session, req: NextRequest, ctx: { params: { contactId: string } }) => {
    const body = (await req.json()) as { tags?: string[]; attributes?: Record<string, unknown> };

    let contact = null;
    if (body.tags) {
      contact = await setContactTags(session.tenantId, ctx.params.contactId, body.tags);
    }
    if (body.attributes) {
      contact = await updateContactAttributes(session.tenantId, ctx.params.contactId, body.attributes);
    }
    if (!contact) return NextResponse.json({ error: 'Contact not found, or nothing to update' }, { status: 404 });

    return NextResponse.json({ contact });
  }
);
