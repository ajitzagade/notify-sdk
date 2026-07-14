import { NextRequest, NextResponse } from 'next/server';
import { withPortalSession } from '@/lib/tenantPortalAuth';
import { getCampaignDetail } from '@/lib/campaigns';

/** Mirrors api/tenants/[id]/campaigns/[campaignId]/route.ts, scoped to session.tenantId only. */
export const GET = withPortalSession(
  async (session, _req: NextRequest, ctx: { params: { campaignId: string } }) => {
    const detail = await getCampaignDetail(session.tenantId, ctx.params.campaignId);
    if (!detail) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    return NextResponse.json(detail);
  }
);
