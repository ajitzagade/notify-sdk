import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { withPortalSession } from '@/lib/tenantPortalAuth';
import { setTenantLogoUrl } from '@/lib/tenants';

// Portal twin of POST /api/tenants/[id]/logo — tenant from session. SVG is
// deliberately NOT accepted here (unlike the admin route): SVG can embed
// script, and this surface is exposed to non-ops users. Raster formats only.
const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export const POST = withPortalSession(async (session, req: NextRequest) => {
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

  try {
    const blob = await put(`tenants/${session.tenantId}/logo-${Date.now()}.${extension}`, file, {
      access: 'public',
    });
    await setTenantLogoUrl(session.tenantId, blob.url);
    return NextResponse.json({ logoBlobUrl: blob.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[portal logo upload] failed:', message);
    return NextResponse.json({ error: `Logo upload failed: ${message}` }, { status: 502 });
  }
});
