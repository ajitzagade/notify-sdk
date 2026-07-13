import { NextRequest, NextResponse } from 'next/server';
import type { HsmComponent } from '@orgname/notify';
import { withAdminSession } from '@/lib/auth';
import { getTenant, getCredentialStatus } from '@/lib/tenants';
import { getCampaign, markCampaignRunning, completeCampaign, type CampaignRecord } from '@/lib/campaigns';
import { getListPhones } from '@/lib/broadcastLists';
import { getTenantRegistry } from '@/lib/tenantRegistry';

/** Fills the template's media HEADER component, if the campaign has one attached. */
function buildHeaderComponent(campaign: CampaignRecord): HsmComponent | null {
  const { headerMediaType: type, headerMediaUrl: link } = campaign;
  if (!type || !link) return null;
  switch (type) {
    case 'image':    return { type: 'header', parameters: [{ type: 'image', image: { link } }] };
    case 'video':    return { type: 'header', parameters: [{ type: 'video', video: { link } }] };
    case 'document': return { type: 'header', parameters: [{ type: 'document', document: { link } }] };
    default:         return null;
  }
}

/**
 * Runs synchronously (no background job queue — reasonable for an internal
 * ops tool's list sizes; the underlying SDK's BullQueueAdapter is the right
 * layer for real async/rate-limited delivery at scale, this just drives it).
 */
export const POST = withAdminSession(
  async (_session, _req: NextRequest, ctx: { params: { id: string; campaignId: string } }) => {
    const tenant = await getTenant(ctx.params.id);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const campaign = await getCampaign(tenant.id, ctx.params.campaignId);
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.status !== 'draft') {
      return NextResponse.json({ error: `Campaign already ${campaign.status}` }, { status: 409 });
    }

    const status = await getCredentialStatus(tenant.id);
    if (!status.configured) {
      return NextResponse.json({ error: 'No WhatsApp credentials configured for this tenant yet' }, { status: 400 });
    }

    const phones = await getListPhones(campaign.broadcastListId);
    if (!phones.length) {
      return NextResponse.json({ error: 'Broadcast list has no members' }, { status: 400 });
    }

    await markCampaignRunning(campaign.id);

    try {
      const components: HsmComponent[] = [];
      const headerComponent = buildHeaderComponent(campaign);
      if (headerComponent) components.push(headerComponent);
      if (campaign.hsmParams.length) {
        components.push({ type: 'body', parameters: campaign.hsmParams.map((v) => ({ type: 'text' as const, text: v })) });
      }

      const client = await getTenantRegistry().getClient(tenant.id);
      const result = await client.sendBulk({
        recipients: phones,
        template:   'text',
        hsmTemplate: {
          name:       campaign.hsmTemplateName,
          language:   campaign.hsmLanguage,
          components: components.length ? components : undefined,
        },
        batchSize:             50,
        delayBetweenBatchesMs: 1000,
      });

      await completeCampaign(campaign.id, 'completed', result as unknown as Record<string, unknown>);
      return NextResponse.json({ ok: true, result });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await completeCampaign(campaign.id, 'failed', { error: msg });
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }
);
