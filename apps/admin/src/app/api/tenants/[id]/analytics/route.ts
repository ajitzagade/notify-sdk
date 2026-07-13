import { NextRequest, NextResponse } from 'next/server';
import { withAdminSession } from '@/lib/auth';
import { getTenant } from '@/lib/tenants';
import { listCampaigns } from '@/lib/campaigns';
import { getTenantRollup, getCampaignLiveStats } from '@/lib/analytics';

export const GET = withAdminSession(async (_session, _req: NextRequest, ctx: { params: { id: string } }) => {
  const tenant = await getTenant(ctx.params.id);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const [rollup, campaigns, liveStats] = await Promise.all([
    getTenantRollup(tenant.id),
    listCampaigns(tenant.id),
    getCampaignLiveStats(tenant.id),
  ]);

  const campaignsWithStats = campaigns.map((c) => ({
    ...c,
    live: liveStats.get(c.id) ?? null,
  }));

  return NextResponse.json({ rollup, campaigns: campaignsWithStats });
});
