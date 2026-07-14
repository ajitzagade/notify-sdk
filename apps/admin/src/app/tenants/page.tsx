import { requireAdminSessionOrRedirect } from '@/lib/auth';
import { listTenants } from '@/lib/tenants';
import { NewTenantForm } from './NewTenantForm';
import { TenantsOverview } from './TenantsOverview';

export default async function TenantsPage() {
  requireAdminSessionOrRedirect();
  const tenants = await listTenants();

  return (
    <>
      <header className="flex items-center justify-between border-b border-border px-8 py-5">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Tenants</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Every business running on this platform, in one place.</p>
        </div>
        <NewTenantForm />
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-8 py-8">
        <TenantsOverview tenants={tenants} />
        {tenants.length === 0 && <div className="mt-4 flex justify-center"><NewTenantForm /></div>}
      </div>
    </>
  );
}
