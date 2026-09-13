import { NextRequest, NextResponse } from 'next/server';
import type { HsmComponent } from '@orgname/notify';
import { withPortalSession } from '@/lib/tenantPortalAuth';
import { getCredentialStatus } from '@/lib/tenants';
import { getCampaign, markCampaignRunning, completeCampaign, type CampaignRecord } from '@/lib/campaigns';
import { getListPhones } from '@/lib/broadcastLists';
import { getTenantRegistry } from '@/lib/tenantRegistry';
import { CAMPAIGN_BATCH_SIZE, CAMPAIGN_BATCH_DELAY_MS } from '@/lib/bulkSendConfig';

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

/** Mirrors apps/admin/src/app/api/tenants/[id]/campaigns/[campaignId]/run/route.ts, scoped to session.tenantId only. */
export const POST = withPortalSession(
  async (session, _req: NextRequest, ctx: { params: { campaignId: string } }) => {
    const campaign = await getCampaign(session.tenantId, ctx.params.campaignId);
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.status !== 'draft') {
      return NextResponse.json({ error: `Campaign already ${campaign.status}` }, { status: 409 });
    }

    const status = await getCredentialStatus(session.tenantId);
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

      const client = await getTenantRegistry().getClient(session.tenantId);
      const result = await client.sendBulk({
        recipients: phones,
        template:   'text',
        hsmTemplate: {
          name:       campaign.hsmTemplateName,
          language:   campaign.hsmLanguage,
          components: components.length ? components : undefined,
        },
        batchSize:             CAMPAIGN_BATCH_SIZE,
        delayBetweenBatchesMs: CAMPAIGN_BATCH_DELAY_MS,
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
