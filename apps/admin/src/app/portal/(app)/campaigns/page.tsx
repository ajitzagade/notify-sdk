import { requirePortalSessionOrRedirect } from '@/lib/tenantPortalAuth';
import { listBroadcastLists } from '@/lib/broadcastLists';
import { listTemplates } from '@/lib/templates';
import { listCampaigns } from '@/lib/campaigns';
import { listMediaAssets } from '@/lib/media';
import { getTenant } from '@/lib/tenants';
import { ImportContactsForm } from '@/app/tenants/[id]/campaigns/ImportContactsForm';
import { CampaignsPanel } from '@/app/tenants/[id]/campaigns/CampaignsPanel';

export default async function PortalCampaignsPage() {
  const session = requirePortalSessionOrRedirect();
  const tenant = await getTenant(session.tenantId);

  const [lists, templates, campaigns, mediaAssets] = await Promise.all([
    listBroadcastLists(session.tenantId),
    listTemplates(session.tenantId),
    listCampaigns(session.tenantId),
    listMediaAssets(session.tenantId),
  ]);

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <h1 className="text-lg font-semibold tracking-tight">Campaigns</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Broadcast lists and bulk sends.</p>
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-8 py-8">
        <div className="grid gap-6">
          <ImportContactsForm tenantId={session.tenantId} lists={lists} baseApiPath="/api/portal" />
          <CampaignsPanel
            tenantId={session.tenantId}
            tenantName={tenant?.name ?? ''}
            lists={lists}
            templates={templates}
            campaigns={campaigns}
            mediaAssets={mediaAssets}
            baseApiPath="/api/portal"
            mediaUploadHint="contact your ops team to add one"
          />
        </div>
      </div>
    </>
  );
}
