import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { withPortalSession } from '@/lib/tenantPortalAuth';
import { listMediaAssets, createMediaAsset, inferMediaKind } from '@/lib/media';

// Portal twin of /api/tenants/[id]/media — same validation, tenant from session.
const MAX_MEDIA_BYTES = 16 * 1024 * 1024; // 16MB — matches Meta's Cloud API document/image cap
const ALLOWED_TYPE_PREFIXES = ['image/', 'video/', 'audio/', 'application/pdf'];

export const GET = withPortalSession(async (session) => {
  const assets = await listMediaAssets(session.tenantId);
  return NextResponse.json({ assets });
});

export const POST = withPortalSession(async (session, req: NextRequest) => {
  const formData = await req.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required (multipart/form-data)' }, { status: 400 });
  }
  // SVG is excluded for the same reason as the portal logo route: it can
  // embed script, and this surface is exposed to non-ops users.
  if (!ALLOWED_TYPE_PREFIXES.some((p) => file.type.startsWith(p)) || file.type === 'image/svg+xml') {
    return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 400 });
  }
  if (file.size > MAX_MEDIA_BYTES) {
    return NextResponse.json({ error: 'File must be under 16MB' }, { status: 400 });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: 'BLOB_READ_WRITE_TOKEN is not configured — media upload unavailable.' },
      { status: 503 }
    );
  }

  const blob = await put(`tenants/${session.tenantId}/media/${Date.now()}-${file.name}`, file, {
    access: 'public',
    addRandomSuffix: true, // pinned: the library's v1 default flip to false would make URLs guessable
  });

  const asset = await createMediaAsset({
    tenantId:          session.tenantId,
    kind:               inferMediaKind(file.type),
    blobUrl:            blob.url,
    contentType:        file.type,
    sizeBytes:          file.size,
    originalFilename:   file.name,
  });

  return NextResponse.json({ asset }, { status: 201 });
});
