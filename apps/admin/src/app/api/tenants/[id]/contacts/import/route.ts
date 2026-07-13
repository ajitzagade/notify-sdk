import { NextRequest, NextResponse } from 'next/server';
import { PostgresAdapter } from '@orgname/notify';
import { withAdminSession } from '@/lib/auth';
import { getTenant } from '@/lib/tenants';
import { upsertContact, parseContactsCsv } from '@/lib/contacts';
import { findOrCreateBroadcastList, addMembersToList } from '@/lib/broadcastLists';
import { getPool } from '@/lib/db';

/**
 * Imports a `phone,name` CSV, upserts each row as a contact, adds them all to
 * a (possibly new) broadcast list, and — only if `alreadyOptedIn` is
 * explicitly attested by the admin — marks them opted-in via a direct
 * tenant-scoped PostgresAdapter write (setPreference), NOT client.optIn(),
 * which would fire a real "you are now subscribed" WhatsApp message to every
 * imported contact. Bulk-marking consent is for contacts who already agreed
 * elsewhere (e.g. a signup form); it deliberately doesn't require WhatsApp
 * credentials to be configured yet, since it's a pure storage write.
 */
export const POST = withAdminSession(async (_session, req: NextRequest, ctx: { params: { id: string } }) => {
  const tenant = await getTenant(ctx.params.id);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const body = (await req.json()) as { csv?: string; listName?: string; alreadyOptedIn?: boolean; tags?: string[] };
  const csv      = body.csv?.trim();
  const listName = body.listName?.trim();
  if (!csv) return NextResponse.json({ error: 'csv is required' }, { status: 400 });
  if (!listName) return NextResponse.json({ error: 'listName is required' }, { status: 400 });

  const rows = parseContactsCsv(csv);
  if (!rows.length) return NextResponse.json({ error: 'No valid rows found (expected "phone,name" per line)' }, { status: 400 });

  // Tags apply to the whole batch (e.g. "Q3 signup form") — merged into any
  // tags a contact already has, never a destructive replace on re-import.
  const tags = body.tags?.filter(Boolean);
  const contacts = await Promise.all(rows.map((r) => upsertContact(tenant.id, r.phone, r.name, tags)));
  const list = await findOrCreateBroadcastList(tenant.id, listName);
  await addMembersToList(list.id, contacts.map((c) => c.id));

  if (body.alreadyOptedIn) {
    const storage = new PostgresAdapter(getPool(), tenant.id);
    await Promise.all(contacts.map((c) => storage.setPreference(c.phone, { optedIn: true, phone: c.phone })));
  }

  return NextResponse.json({ imported: contacts.length, list, optedIn: Boolean(body.alreadyOptedIn) }, { status: 201 });
});
