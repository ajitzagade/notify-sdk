import { NextRequest, NextResponse } from 'next/server';
import { withAdminSession } from '@/lib/auth';
import { listTenants, createTenant, isValidSlug } from '@/lib/tenants';

export const GET = withAdminSession(async () => {
  const tenants = await listTenants();
  return NextResponse.json({ tenants });
});

export const POST = withAdminSession(async (_session, req: NextRequest) => {
  const body = (await req.json()) as { name?: string; slug?: string; businessDescription?: string };
  const name = body.name?.trim();
  const slug = body.slug?.trim().toLowerCase();

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (!slug || !isValidSlug(slug)) {
    return NextResponse.json(
      { error: 'slug must be lowercase alphanumeric with hyphens, 2-100 chars' },
      { status: 400 }
    );
  }

  try {
    const tenant = await createTenant({ name, slug, businessDescription: body.businessDescription });
    return NextResponse.json({ tenant }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('duplicate key') && msg.includes('slug')) {
      return NextResponse.json({ error: `Slug "${slug}" is already taken` }, { status: 409 });
    }
    throw err;
  }
});
