import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Megaphone, Inbox, Users } from 'lucide-react';
import { requireAdminSessionOrRedirect } from '@/lib/auth';
import { getTenant, getCredentialStatus } from '@/lib/tenants';
import { listMediaAssets } from '@/lib/media';
import { listTemplates } from '@/lib/templates';
import { listApiKeys } from '@/lib/apiKeys';
import { listPortalUsers } from '@/lib/tenantPortalUsers';
import { listAuditLog } from '@/lib/auditLog';
import { getAiConfigStatus } from '@/lib/aiConfig';
import { listWebhookEndpoints } from '@/lib/webhookEndpoints';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { BrandingForm } from './BrandingForm';
import { CredentialsForm } from './CredentialsForm';
import { ConnectWhatsAppChooser } from './ConnectWhatsAppChooser';
import { TemplatesPanel } from './TemplatesPanel';
import { TestSendForm } from './TestSendForm';
import { ApiKeysPanel } from './ApiKeysPanel';
import { PortalAccessPanel } from './PortalAccessPanel';
import { AuditLogPanel } from './AuditLogPanel';
import { AnalyticsPanel } from './AnalyticsPanel';
import { AiAssistantPanel } from './AiAssistantPanel';
import { WebhooksPanel } from './WebhooksPanel';
import { TenantWorkspaceTabs } from './TenantWorkspaceTabs';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  active:    'default',
  suspended: 'secondary',
  archived:  'outline',
};

export default async function TenantDetailPage({ params }: { params: { id: string } }) {
  requireAdminSessionOrRedirect();
  const tenant = await getTenant(params.id);
  if (!tenant) notFound();
  const [credentials, mediaAssets, templates, apiKeys, portalUsers, auditEntries, aiStatus, webhookEndpoints] = await Promise.all([
    getCredentialStatus(tenant.id),
    listMediaAssets(tenant.id),
    listTemplates(tenant.id),
    listApiKeys(tenant.id),
    listPortalUsers(tenant.id),
    listAuditLog(tenant.id),
    getAiConfigStatus(tenant.id),
    listWebhookEndpoints(tenant.id),
  ]);

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <Breadcrumb
          className="mb-3"
          items={[{ label: 'Tenants', href: '/tenants' }, { label: tenant.name }]}
        />
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <Avatar className="size-10 rounded-lg">
              {tenant.logoBlobUrl && <AvatarImage src={tenant.logoBlobUrl} alt="" />}
              <AvatarFallback color={tenant.primaryColor} className="rounded-lg text-sm">
                {tenant.name.slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h1 className="truncate text-lg font-semibold tracking-tight">{tenant.name}</h1>
                <Badge variant={STATUS_VARIANT[tenant.status] ?? 'outline'}>{tenant.status}</Badge>
              </div>
              <div className="font-mono text-xs text-muted-foreground">{tenant.slug}</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" render={<Link href={`/tenants/${tenant.id}/inbox`} />}>
              <Inbox /> Inbox
            </Button>
            <Button variant="outline" size="sm" render={<Link href={`/tenants/${tenant.id}/contacts`} />}>
              <Users /> Contacts
            </Button>
            <Button variant="outline" size="sm" render={<Link href={`/tenants/${tenant.id}/campaigns`} />}>
              <Megaphone /> Campaigns
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-8 py-8">
        <TenantWorkspaceTabs
          analytics={<AnalyticsPanel tenantId={tenant.id} />}
          ai={<AiAssistantPanel tenantId={tenant.id} status={aiStatus} />}
          portalAccess={<PortalAccessPanel tenantId={tenant.id} users={portalUsers} />}
          webhooks={<WebhooksPanel tenantId={tenant.id} endpoints={webhookEndpoints} />}
          audit={<AuditLogPanel entries={auditEntries} />}
          branding={<BrandingForm tenant={tenant} />}
          credentials={
            <ConnectWhatsAppChooser tenantId={tenant.id} configured={credentials.configured}>
              <CredentialsForm tenantId={tenant.id} status={credentials} />
            </ConnectWhatsAppChooser>
          }
          templates={
            <TemplatesPanel
              tenantId={tenant.id}
              templates={templates}
              tenantCategory={tenant.category}
              credentialsReady={credentials.configured && Boolean(credentials.wabaId)}
            />
          }
          testSend={
            <TestSendForm
              tenantId={tenant.id}
              tenantName={tenant.name}
              credentialsConfigured={credentials.configured}
              mediaAssets={mediaAssets}
              templates={templates}
            />
          }
          apiKeys={<ApiKeysPanel tenantId={tenant.id} apiKeys={apiKeys} />}
        />
      </div>
    </>
  );
}
