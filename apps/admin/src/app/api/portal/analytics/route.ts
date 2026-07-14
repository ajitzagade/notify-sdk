import { NextResponse } from 'next/server';
import { withPortalSession } from '@/lib/tenantPortalAuth';
import { listCampaigns } from '@/lib/campaigns';
import { getTenantRollup, getCampaignLiveStats, getDailyActivity } from '@/lib/analytics';

export const GET = withPortalSession(async (session) => {
  const [rollup, campaigns, liveStats, daily] = await Promise.all([
    getTenantRollup(session.tenantId),
    listCampaigns(session.tenantId),
    getCampaignLiveStats(session.tenantId),
    getDailyActivity(session.tenantId),
  ]);

  const campaignsWithStats = campaigns.map((c) => ({
    ...c,
    live: liveStats.get(c.id) ?? null,
  }));

  return NextResponse.json({ rollup, campaigns: campaignsWithStats, daily });
});
