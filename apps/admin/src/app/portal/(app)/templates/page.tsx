import { LayoutTemplate } from 'lucide-react';
import { PageTitle } from '@/components/page-title';
import { requirePortalSessionOrRedirect } from '@/lib/tenantPortalAuth';
import { listTemplates } from '@/lib/templates';
import { TemplatesPanel } from '@/app/tenants/[id]/TemplatesPanel';

export default async function PortalTemplatesPage() {
  const session = requirePortalSessionOrRedirect();
  const templates = await listTemplates(session.tenantId);

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <PageTitle icon={LayoutTemplate} title="Templates" description={"Meta-approved WhatsApp templates."} />
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-8 py-8">
        <TemplatesPanel tenantId={session.tenantId} templates={templates} baseApiPath="/api/portal" />
      </div>
    </>
  );
}
