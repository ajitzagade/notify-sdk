import { NextRequest, NextResponse } from 'next/server';
import { withAdminSession } from '@/lib/auth';
import { getTenant } from '@/lib/tenants';
import { listCampaigns, createCampaign, type HeaderMediaType } from '@/lib/campaigns';

export const GET = withAdminSession(async (_session, _req: NextRequest, ctx: { params: { id: string } }) => {
  const tenant = await getTenant(ctx.params.id);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const campaigns = await listCampaigns(tenant.id);
  return NextResponse.json({ campaigns });
});

export const POST = withAdminSession(async (session, req: NextRequest, ctx: { params: { id: string } }) => {
  const tenant = await getTenant(ctx.params.id);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const body = (await req.json()) as {
    name?: string;
    broadcastListId?: string;
    hsmTemplateName?: string;
    hsmLanguage?: string;
    hsmParams?: string[];
    headerMediaType?: HeaderMediaType;
    headerMediaUrl?: string;
  };

  if (!body.name || !body.broadcastListId || !body.hsmTemplateName || !body.hsmLanguage) {
    return NextResponse.json(
      { error: 'name, broadcastListId, hsmTemplateName, and hsmLanguage are required' },
      { status: 400 }
    );
  }
  if (body.headerMediaType && !body.headerMediaUrl) {
    return NextResponse.json({ error: 'headerMediaUrl is required when headerMediaType is set' }, { status: 400 });
  }

  const campaign = await createCampaign({
    tenantId:          tenant.id,
    name:              body.name,
    broadcastListId:   body.broadcastListId,
    hsmTemplateName:   body.hsmTemplateName,
    hsmLanguage:       body.hsmLanguage,
    hsmParams:         body.hsmParams ?? [],
    headerMediaType:   body.headerMediaType ?? null,
    headerMediaUrl:    body.headerMediaUrl ?? null,
    createdByAdminId:  session.adminUserId,
  });

  return NextResponse.json({ campaign }, { status: 201 });
});
