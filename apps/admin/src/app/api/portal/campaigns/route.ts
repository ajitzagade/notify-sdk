import { NextRequest, NextResponse } from 'next/server';
import { withPortalSession } from '@/lib/tenantPortalAuth';
import { listCampaigns, createCampaign, type HeaderMediaType } from '@/lib/campaigns';
import { getBroadcastList } from '@/lib/broadcastLists';

export const GET = withPortalSession(async (session) => {
  const campaigns = await listCampaigns(session.tenantId);
  return NextResponse.json({ campaigns });
});

export const POST = withPortalSession(async (session, req: NextRequest) => {
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

  const list = await getBroadcastList(session.tenantId, body.broadcastListId);
  if (!list) return NextResponse.json({ error: 'Broadcast list not found' }, { status: 404 });

  const campaign = await createCampaign({
    tenantId:              session.tenantId,
    name:                  body.name,
    broadcastListId:       body.broadcastListId,
    hsmTemplateName:       body.hsmTemplateName,
    hsmLanguage:           body.hsmLanguage,
    hsmParams:             body.hsmParams ?? [],
    headerMediaType:       body.headerMediaType ?? null,
    headerMediaUrl:        body.headerMediaUrl ?? null,
    createdByTenantUserId: session.tenantUserId,
  });

  return NextResponse.json({ campaign }, { status: 201 });
});
