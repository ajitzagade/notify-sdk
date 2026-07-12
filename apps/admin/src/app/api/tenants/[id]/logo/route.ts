import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { withAdminSession } from '@/lib/auth';
import { getTenant, setTenantLogoUrl } from '@/lib/tenants';

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

export const POST = withAdminSession(async (_session, req: NextRequest, ctx: { params: { id: string } }) => {
  const tenant = await getTenant(ctx.params.id);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required (multipart/form-data)' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 400 });
  }
  if (file.size > MAX_LOGO_BYTES) {
    return NextResponse.json({ error: 'Logo must be under 2MB' }, { status: 400 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: 'BLOB_READ_WRITE_TOKEN is not configured — logo upload unavailable.' },
      { status: 503 }
    );
  }

  const extension = file.type.split('/')[1] === 'svg+xml' ? 'svg' : file.type.split('/')[1];
  const blob = await put(`tenants/${tenant.id}/logo-${Date.now()}.${extension}`, file, {
    access: 'public',
  });

  await setTenantLogoUrl(tenant.id, blob.url);
  return NextResponse.json({ logoBlobUrl: blob.url });
});
