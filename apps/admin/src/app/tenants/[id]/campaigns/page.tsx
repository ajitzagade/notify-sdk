import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireAdminSessionOrRedirect } from '@/lib/auth';
import { getTenant } from '@/lib/tenants';
import { listBroadcastLists } from '@/lib/broadcastLists';
import { listTemplates } from '@/lib/templates';
import { listCampaigns } from '@/lib/campaigns';
import { ImportContactsForm } from './ImportContactsForm';
import { CampaignsPanel } from './CampaignsPanel';

export default async function CampaignsPage({ params }: { params: { id: string } }) {
  requireAdminSessionOrRedirect();
  const tenant = await getTenant(params.id);
  if (!tenant) notFound();

  const [lists, templates, campaigns] = await Promise.all([
    listBroadcastLists(tenant.id),
    listTemplates(tenant.id),
    listCampaigns(tenant.id),
  ]);

  return (
    <main style={{ maxWidth: 640, margin: '48px auto', padding: '0 20px' }}>
      <Link href={`/tenants/${tenant.id}`} style={{ fontSize: 13, color: '#666', textDecoration: 'none' }}>&larr; {tenant.name}</Link>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: '8px 0 24px' }}>Campaigns</h1>

      <ImportContactsForm tenantId={tenant.id} lists={lists} />
      <CampaignsPanel tenantId={tenant.id} lists={lists} templates={templates} campaigns={campaigns} />
    </main>
  );
}
