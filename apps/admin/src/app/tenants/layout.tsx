import { requireAdminSessionOrRedirect } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';

export default async function TenantsLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdminSessionOrRedirect();

  return (
    <AppShell email={session.email} role={session.role}>
      {children}
    </AppShell>
  );
}
