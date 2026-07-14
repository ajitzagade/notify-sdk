import { Building2 } from 'lucide-react';
import { requireAdminSessionOrRedirect } from '@/lib/auth';
import { PageTitle } from '@/components/page-title';
import { listTenants } from '@/lib/tenants';
import { NewTenantForm } from './NewTenantForm';
import { TenantsOverview } from './TenantsOverview';

export default async function TenantsPage() {
  requireAdminSessionOrRedirect();
  const tenants = await listTenants();

  return (
    <>
      <header className="flex items-center justify-between border-b border-border px-8 py-5">
        <PageTitle icon={Building2} title="Tenants" description="Every business running on this platform, in one place." />
        <NewTenantForm />
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-8 py-8">
        <TenantsOverview tenants={tenants} />
        {tenants.length === 0 && <div className="mt-4 flex justify-center"><NewTenantForm /></div>}
      </div>
    </>
  );
}
