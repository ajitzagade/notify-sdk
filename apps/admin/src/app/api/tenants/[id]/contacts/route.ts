import { NextRequest, NextResponse } from 'next/server';
import { withAdminSession } from '@/lib/auth';
import { getTenant } from '@/lib/tenants';
import { listContacts, listDistinctTags } from '@/lib/contacts';

export const GET = withAdminSession(async (_session, req: NextRequest, ctx: { params: { id: string } }) => {
  const tenant = await getTenant(ctx.params.id);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const tag = req.nextUrl.searchParams.get('tag') ?? undefined;
  const [contacts, allTags] = await Promise.all([
    listContacts(tenant.id, tag),
    listDistinctTags(tenant.id),
  ]);
  return NextResponse.json({ contacts, allTags });
});
