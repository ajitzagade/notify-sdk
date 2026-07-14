import { NextRequest, NextResponse } from 'next/server';
import { withAdminSession } from '@/lib/auth';
import { getCampaignDetail } from '@/lib/campaigns';

export const GET = withAdminSession(
  async (_session, _req: NextRequest, ctx: { params: { id: string; campaignId: string } }) => {
    const detail = await getCampaignDetail(ctx.params.id, ctx.params.campaignId);
    if (!detail) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    return NextResponse.json(detail);
  }
);
