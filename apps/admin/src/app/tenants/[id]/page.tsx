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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { BrandingForm } from './BrandingForm';
import { CredentialsForm } from './CredentialsForm';
import { TemplatesPanel } from './TemplatesPanel';
import { TestSendForm } from './TestSendForm';
import { ApiKeysPanel } from './ApiKeysPanel';
import { PortalAccessPanel } from './PortalAccessPanel';
import { AuditLogPanel } from './AuditLogPanel';
import { AnalyticsPanel } from './AnalyticsPanel';
import { AiAssistantPanel } from './AiAssistantPanel';
import { WebhooksPanel } from './WebhooksPanel';

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
        <Tabs defaultValue="analytics">
          <span className="font-mono text-[10.5px] font-medium tracking-wider text-muted-foreground uppercase">Workspace</span>
          <TabsList variant="line" className="mt-1.5">
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="ai">AI assistant</TabsTrigger>
            <TabsTrigger value="portal-access">Portal access</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
            <TabsTrigger value="audit">Audit log</TabsTrigger>
          </TabsList>

          <div className="mt-6 mb-1.5">
            <span className="font-mono text-[10.5px] font-medium tracking-wider text-muted-foreground uppercase">Setup</span>
            <p className="mt-0.5 text-xs text-muted-foreground">One-time steps to get this tenant sending — revisit anytime.</p>
          </div>
          <TabsList variant="steps">
            <TabsTrigger value="branding">Branding</TabsTrigger>
            <TabsTrigger value="credentials">Credentials</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="test-send">Test send</TabsTrigger>
            <TabsTrigger value="api-keys">API keys</TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className="mt-5">
            <AnalyticsPanel tenantId={tenant.id} />
          </TabsContent>
          <TabsContent value="branding" className="mt-5">
            <BrandingForm tenant={tenant} />
          </TabsContent>
          <TabsContent value="credentials" className="mt-5">
            <CredentialsForm tenantId={tenant.id} status={credentials} />
          </TabsContent>
          <TabsContent value="templates" className="mt-5">
            <TemplatesPanel tenantId={tenant.id} templates={templates} />
          </TabsContent>
          <TabsContent value="test-send" className="mt-5">
            <TestSendForm
              tenantId={tenant.id}
              tenantName={tenant.name}
              credentialsConfigured={credentials.configured}
              mediaAssets={mediaAssets}
              templates={templates}
            />
          </TabsContent>
          <TabsContent value="ai" className="mt-5">
            <AiAssistantPanel tenantId={tenant.id} status={aiStatus} />
          </TabsContent>
          <TabsContent value="api-keys" className="mt-5">
            <ApiKeysPanel tenantId={tenant.id} apiKeys={apiKeys} />
          </TabsContent>
          <TabsContent value="portal-access" className="mt-5">
            <PortalAccessPanel tenantId={tenant.id} users={portalUsers} />
          </TabsContent>
          <TabsContent value="webhooks" className="mt-5">
            <WebhooksPanel tenantId={tenant.id} endpoints={webhookEndpoints} />
          </TabsContent>
          <TabsContent value="audit" className="mt-5">
            <AuditLogPanel entries={auditEntries} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
