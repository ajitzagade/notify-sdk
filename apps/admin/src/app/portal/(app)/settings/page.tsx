import { Settings, PhoneCall, CheckCircle2 } from 'lucide-react';
import { PageTitle } from '@/components/page-title';
import { requirePortalSessionOrRedirect } from '@/lib/tenantPortalAuth';
import { getTenant, getCredentialStatus } from '@/lib/tenants';
import { listMediaAssets } from '@/lib/media';
import { listTemplates } from '@/lib/templates';
import { listApiKeys } from '@/lib/apiKeys';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { CardTitleGroup } from '@/components/card-title-group';
import { BrandingForm } from '@/app/tenants/[id]/BrandingForm';
import { TestSendForm } from '@/app/tenants/[id]/TestSendForm';
import { ApiKeysPanel } from '@/app/tenants/[id]/ApiKeysPanel';
import { EmbeddedSignupButton } from '@/app/tenants/[id]/EmbeddedSignupButton';

export default async function PortalSettingsPage() {
  const session = requirePortalSessionOrRedirect();
  const [tenant, credentials, mediaAssets, templates, apiKeys] = await Promise.all([
    getTenant(session.tenantId),
    getCredentialStatus(session.tenantId),
    listMediaAssets(session.tenantId),
    listTemplates(session.tenantId),
    listApiKeys(session.tenantId),
  ]);
  if (!tenant) return null;

  const embeddedSignupReady = Boolean(process.env.NEXT_PUBLIC_META_APP_ID && process.env.NEXT_PUBLIC_META_ES_CONFIG_ID);

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <PageTitle icon={Settings} title="Settings" description="Your WhatsApp connection, branding, test sends, and API keys." />
      </header>

      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitleGroup
              icon={PhoneCall}
              title="WhatsApp connection"
              description="The WhatsApp Business number this workspace sends from."
            />
          </CardHeader>
          <CardContent className="grid gap-3">
            {credentials.configured ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <CheckCircle2 className="size-4 text-emerald-500" />
                <span>
                  Connected — phone number ID <code>{credentials.phoneNumberId}</code>
                  {credentials.lastVerifiedStatus ? <> · last verified: {credentials.lastVerifiedStatus}</> : null}
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Not connected yet. Use your company&apos;s Facebook account — Meta&apos;s guided popup creates your
                WhatsApp Business account and registers your phone number. Nobody ever sees or handles a raw access token.
              </p>
            )}
            {embeddedSignupReady ? (
              <div>
                <EmbeddedSignupButton tenantId={session.tenantId} endpoint="/api/portal/embedded-signup" />
                {credentials.configured && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Reconnecting replaces the current number — only do this if you&apos;re changing WhatsApp accounts.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Self-serve connection isn&apos;t available right now — contact support to connect your number.
              </p>
            )}
          </CardContent>
        </Card>

        <BrandingForm tenant={tenant} updateUrl="/api/portal/tenant" logoUrl="/api/portal/logo" />

        <TestSendForm
          tenantId={session.tenantId}
          tenantName={tenant.name}
          credentialsConfigured={credentials.configured}
          mediaAssets={mediaAssets}
          templates={templates}
          baseApiPath="/api/portal"
        />

        <ApiKeysPanel tenantId={session.tenantId} apiKeys={apiKeys} baseApiPath="/api/portal" />
      </div>
    </>
  );
}
