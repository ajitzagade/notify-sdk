import { NextRequest, NextResponse } from 'next/server';
import { PostgresAdapter } from '@orgname/notify';
import { withPortalSession } from '@/lib/tenantPortalAuth';
import { upsertContact, parseContactsCsv } from '@/lib/contacts';
import { findOrCreateBroadcastList, addMembersToList } from '@/lib/broadcastLists';
import { getPool } from '@/lib/db';

/** Mirrors apps/admin/src/app/api/tenants/[id]/contacts/import/route.ts — see that file's header comment for the opt-in write's rationale. */
export const POST = withPortalSession(async (session, req: NextRequest) => {
  const body = (await req.json()) as { csv?: string; listName?: string; alreadyOptedIn?: boolean; tags?: string[] };
  const csv      = body.csv?.trim();
  const listName = body.listName?.trim();
  if (!csv) return NextResponse.json({ error: 'csv is required' }, { status: 400 });
  if (!listName) return NextResponse.json({ error: 'listName is required' }, { status: 400 });

  const rows = parseContactsCsv(csv);
  if (!rows.length) return NextResponse.json({ error: 'No valid rows found (expected "phone,name" per line)' }, { status: 400 });

  const tags = body.tags?.filter(Boolean);
  const contacts = await Promise.all(rows.map((r) => upsertContact(session.tenantId, r.phone, r.name, tags)));
  const list = await findOrCreateBroadcastList(session.tenantId, listName);
  await addMembersToList(list.id, contacts.map((c) => c.id));

  if (body.alreadyOptedIn) {
    const storage = new PostgresAdapter(getPool(), session.tenantId);
    await Promise.all(contacts.map((c) => storage.setPreference(c.phone, { optedIn: true, phone: c.phone })));
  }

  return NextResponse.json({ imported: contacts.length, list, optedIn: Boolean(body.alreadyOptedIn) }, { status: 201 });
});
