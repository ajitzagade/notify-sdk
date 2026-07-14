import { notFound } from 'next/navigation';
import { requireAdminSessionOrRedirect } from '@/lib/auth';
import { getTenant } from '@/lib/tenants';
import { listBroadcastLists } from '@/lib/broadcastLists';
import { listTemplates } from '@/lib/templates';
import { listCampaigns } from '@/lib/campaigns';
import { listMediaAssets } from '@/lib/media';
import { Megaphone } from 'lucide-react';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { PageTitle } from '@/components/page-title';
import { ImportContactsForm } from './ImportContactsForm';
import { CampaignsPanel } from './CampaignsPanel';

export default async function CampaignsPage({ params }: { params: { id: string } }) {
  requireAdminSessionOrRedirect();
  const tenant = await getTenant(params.id);
  if (!tenant) notFound();

  const [lists, templates, campaigns, mediaAssets] = await Promise.all([
    listBroadcastLists(tenant.id),
    listTemplates(tenant.id),
    listCampaigns(tenant.id),
    listMediaAssets(tenant.id),
  ]);

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <Breadcrumb
          className="mb-3"
          items={[
            { label: 'Tenants', href: '/tenants' },
            { label: tenant.name, href: `/tenants/${tenant.id}` },
            { label: 'Campaigns' },
          ]}
        />
        <PageTitle icon={Megaphone} title="Campaigns" description={`Broadcast lists and bulk sends for ${tenant.name}.`} />
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-8 py-8">
        <div className="grid gap-6">
          <ImportContactsForm tenantId={tenant.id} lists={lists} />
          <CampaignsPanel
            tenantId={tenant.id}
            tenantName={tenant.name}
            lists={lists}
            templates={templates}
            campaigns={campaigns}
            mediaAssets={mediaAssets}
          />
        </div>
      </div>
    </>
  );
}
