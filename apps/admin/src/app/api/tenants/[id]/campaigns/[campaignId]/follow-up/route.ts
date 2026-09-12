import { NextRequest, NextResponse } from 'next/server';
import { withAdminSession } from '@/lib/auth';
import { getTenant } from '@/lib/tenants';
import { getCampaign } from '@/lib/campaigns';
import {
  getFollowUpForCampaign, createFollowUpSequence, setFollowUpActive, deleteFollowUpSequence,
} from '@/lib/followUpSequences';

export const GET = withAdminSession(async (_session, _req: NextRequest, ctx: { params: { id: string; campaignId: string } }) => {
  const tenant = await getTenant(ctx.params.id);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const followUp = await getFollowUpForCampaign(tenant.id, ctx.params.campaignId);
  return NextResponse.json({ followUp });
});

export const POST = withAdminSession(async (_session, req: NextRequest, ctx: { params: { id: string; campaignId: string } }) => {
  const tenant = await getTenant(ctx.params.id);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const campaign = await getCampaign(tenant.id, ctx.params.campaignId);
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  if (campaign.status !== 'completed' || !campaign.broadcastId) {
    return NextResponse.json({ error: 'Follow-ups can only be attached to a completed campaign' }, { status: 400 });
  }

  const body = (await req.json()) as {
    delayDays?: number; hsmTemplateName?: string; hsmLanguage?: string; hsmParams?: string[];
  };
  if (!body.delayDays || body.delayDays < 1 || body.delayDays > 30) {
    return NextResponse.json({ error: 'delayDays must be between 1 and 30' }, { status: 400 });
  }
  if (!body.hsmTemplateName?.trim() || !body.hsmLanguage?.trim()) {
    return NextResponse.json({ error: 'hsmTemplateName and hsmLanguage are required' }, { status: 400 });
  }

  try {
    const followUp = await createFollowUpSequence(tenant.id, {
      campaignId:      campaign.id,
      delayDays:       body.delayDays,
      hsmTemplateName: body.hsmTemplateName.trim(),
      hsmLanguage:     body.hsmLanguage.trim(),
      hsmParams:       body.hsmParams ?? [],
    });
    return NextResponse.json({ followUp }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('duplicate key')) {
      return NextResponse.json({ error: 'This campaign already has a follow-up configured' }, { status: 409 });
    }
    throw err;
  }
});

export const PATCH = withAdminSession(async (_session, req: NextRequest, ctx: { params: { id: string; campaignId: string } }) => {
  const tenant = await getTenant(ctx.params.id);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const followUp = await getFollowUpForCampaign(tenant.id, ctx.params.campaignId);
  if (!followUp) return NextResponse.json({ error: 'No follow-up configured for this campaign' }, { status: 404 });

  const body = (await req.json()) as { isActive?: boolean };
  if (typeof body.isActive !== 'boolean') {
    return NextResponse.json({ error: 'isActive is required' }, { status: 400 });
  }
  await setFollowUpActive(tenant.id, followUp.id, body.isActive);
  return NextResponse.json({ ok: true });
});

export const DELETE = withAdminSession(async (_session, _req: NextRequest, ctx: { params: { id: string; campaignId: string } }) => {
  const tenant = await getTenant(ctx.params.id);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const followUp = await getFollowUpForCampaign(tenant.id, ctx.params.campaignId);
  if (!followUp) return NextResponse.json({ error: 'No follow-up configured for this campaign' }, { status: 404 });

  await deleteFollowUpSequence(tenant.id, followUp.id);
  return NextResponse.json({ ok: true });
});
