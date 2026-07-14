import { requirePortalSessionOrRedirect } from '@/lib/tenantPortalAuth';
import { AnalyticsPanel } from '@/app/tenants/[id]/AnalyticsPanel';

export default function PortalAnalyticsPage() {
  const session = requirePortalSessionOrRedirect();

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <h1 className="text-lg font-semibold tracking-tight">Analytics</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Live counts from every message you&apos;ve sent.</p>
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-8 py-8">
        <AnalyticsPanel tenantId={session.tenantId} baseApiPath="/api/portal" />
      </div>
    </>
  );
}
