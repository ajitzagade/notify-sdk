import { NextRequest, NextResponse } from 'next/server';
import { withPortalSession } from '@/lib/tenantPortalAuth';
import { listContacts, listDistinctTags } from '@/lib/contacts';

export const GET = withPortalSession(async (session, req: NextRequest) => {
  const tag = req.nextUrl.searchParams.get('tag') ?? undefined;
  const [contacts, allTags] = await Promise.all([
    listContacts(session.tenantId, tag),
    listDistinctTags(session.tenantId),
  ]);
  return NextResponse.json({ contacts, allTags });
});
