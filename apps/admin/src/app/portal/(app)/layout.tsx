import { notFound } from 'next/navigation';
import { requirePortalSessionOrRedirect } from '@/lib/tenantPortalAuth';
import { getTenant } from '@/lib/tenants';
import { countOpenConversations } from '@/lib/conversations';
import { PortalShell } from '@/components/portal-shell';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = requirePortalSessionOrRedirect();
  const [tenant, openChatsCount] = await Promise.all([
    getTenant(session.tenantId),
    countOpenConversations(session.tenantId),
  ]);
  if (!tenant) notFound();

  return (
    <PortalShell
      tenantName={tenant.name}
      logoBlobUrl={tenant.logoBlobUrl}
      primaryColor={tenant.primaryColor}
      email={session.email}
      openChatsCount={openChatsCount}
    >
      {children}
    </PortalShell>
  );
}
