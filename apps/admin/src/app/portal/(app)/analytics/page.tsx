import { BarChart3 } from 'lucide-react';
import { PageTitle } from '@/components/page-title';
import { requirePortalSessionOrRedirect } from '@/lib/tenantPortalAuth';
import { AnalyticsPanel } from '@/app/tenants/[id]/AnalyticsPanel';

export default function PortalAnalyticsPage() {
  const session = requirePortalSessionOrRedirect();

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <PageTitle icon={BarChart3} title="Analytics" description={"Live counts from every message you've sent."} />
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-8 py-8">
        <AnalyticsPanel tenantId={session.tenantId} baseApiPath="/api/portal" />
      </div>
    </>
  );
}
