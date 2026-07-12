import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireAdminSessionOrRedirect } from '@/lib/auth';
import { getTenant, getCredentialStatus } from '@/lib/tenants';
import { listMediaAssets } from '@/lib/media';
import { listTemplates } from '@/lib/templates';
import { listApiKeys } from '@/lib/apiKeys';
import { BrandingForm } from './BrandingForm';
import { CredentialsForm } from './CredentialsForm';
import { TemplatesPanel } from './TemplatesPanel';
import { TestSendForm } from './TestSendForm';
import { ApiKeysPanel } from './ApiKeysPanel';

export default async function TenantDetailPage({ params }: { params: { id: string } }) {
  requireAdminSessionOrRedirect();
  const tenant = await getTenant(params.id);
  if (!tenant) notFound();
  const [credentials, mediaAssets, templates, apiKeys] = await Promise.all([
    getCredentialStatus(tenant.id),
    listMediaAssets(tenant.id),
    listTemplates(tenant.id),
    listApiKeys(tenant.id),
  ]);

  return (
    <main style={{ maxWidth: 640, margin: '48px auto', padding: '0 20px' }}>
      <Link href="/tenants" style={{ fontSize: 13, color: '#666', textDecoration: 'none' }}>&larr; Tenants</Link>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '8px 0 24px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>{tenant.name}</h1>
        <Link
          href={`/tenants/${tenant.id}/campaigns`}
          style={{ fontSize: 13, padding: '6px 12px', border: '1px solid #ddd', borderRadius: 6, textDecoration: 'none', color: '#333' }}
        >
          Campaigns &rarr;
        </Link>
      </div>

      <BrandingForm tenant={tenant} />
      <CredentialsForm tenantId={tenant.id} status={credentials} />
      <TemplatesPanel tenantId={tenant.id} templates={templates} />
      <TestSendForm
        tenantId={tenant.id}
        credentialsConfigured={credentials.configured}
        mediaAssets={mediaAssets}
        templates={templates}
      />
      <ApiKeysPanel tenantId={tenant.id} apiKeys={apiKeys} />
    </main>
  );
}
