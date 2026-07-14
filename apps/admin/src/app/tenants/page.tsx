import { Building2, CheckCircle2, Send, MessageSquareReply, type LucideIcon } from 'lucide-react';
import { requireAdminSessionOrRedirect } from '@/lib/auth';
import { PageTitle } from '@/components/page-title';
import { listTenants } from '@/lib/tenants';
import { getPlatformStats } from '@/lib/analytics';
import { NewTenantForm } from './NewTenantForm';
import { TenantsOverview } from './TenantsOverview';

function StatChip({ icon: Icon, label, value, accent }: {
  icon: LucideIcon; label: string; value: string; accent: string;
}) {
  return (
    <div className="rounded-xl border-l-2 bg-card p-4 shadow-sm ring-1 ring-foreground/[0.07]" style={{ borderLeftColor: accent }}>
      <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums leading-tight">{value}</div>
    </div>
  );
}

export default async function TenantsPage() {
  requireAdminSessionOrRedirect();
  const [tenants, stats] = await Promise.all([listTenants(), getPlatformStats()]);

  return (
    <>
      <header className="flex items-center justify-between border-b border-border px-8 py-5">
        <PageTitle icon={Building2} title="Tenants" description="Every business running on this platform, in one place." />
        <NewTenantForm />
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-8 py-8">
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatChip icon={Building2} label="Tenants" value={stats.tenants.toLocaleString()} accent="var(--primary)" />
          <StatChip icon={CheckCircle2} label="Active" value={stats.activeTenants.toLocaleString()} accent="var(--signal)" />
          <StatChip icon={Send} label="Sent · 7 days" value={stats.sent7d.toLocaleString()} accent="var(--chart-3)" />
          <StatChip icon={MessageSquareReply} label="Replies · 7 days" value={stats.replies7d.toLocaleString()} accent="var(--primary-2)" />
        </div>
        <TenantsOverview tenants={tenants} />
        {tenants.length === 0 && <div className="mt-4 flex justify-center"><NewTenantForm /></div>}
      </div>
    </>
  );
}
