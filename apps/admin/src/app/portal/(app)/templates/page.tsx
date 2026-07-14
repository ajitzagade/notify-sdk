import { requirePortalSessionOrRedirect } from '@/lib/tenantPortalAuth';
import { listTemplates } from '@/lib/templates';
import { TemplatesPanel } from '@/app/tenants/[id]/TemplatesPanel';

export default async function PortalTemplatesPage() {
  const session = requirePortalSessionOrRedirect();
  const templates = await listTemplates(session.tenantId);

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <h1 className="text-lg font-semibold tracking-tight">Templates</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Meta-approved WhatsApp templates.</p>
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-8 py-8">
        <TemplatesPanel tenantId={session.tenantId} templates={templates} baseApiPath="/api/portal" />
      </div>
    </>
  );
}
