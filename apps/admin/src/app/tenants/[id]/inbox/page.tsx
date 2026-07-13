import { notFound } from 'next/navigation';
import { requireAdminSessionOrRedirect } from '@/lib/auth';
import { getTenant } from '@/lib/tenants';
import { listConversations } from '@/lib/conversations';
import { listAdminUsers } from '@/lib/adminUsers';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { InboxClient } from './InboxClient';

export default async function InboxPage({ params }: { params: { id: string } }) {
  requireAdminSessionOrRedirect();
  const tenant = await getTenant(params.id);
  if (!tenant) notFound();

  const [conversations, adminUsers] = await Promise.all([
    listConversations(tenant.id),
    listAdminUsers(),
  ]);

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <Breadcrumb
          className="mb-3"
          items={[
            { label: 'Tenants', href: '/tenants' },
            { label: tenant.name, href: `/tenants/${tenant.id}` },
            { label: 'Inbox' },
          ]}
        />
        <h1 className="text-lg font-semibold tracking-tight">Inbox</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Every conversation with {tenant.name}&apos;s customers, in one place.</p>
      </header>

      <div className="flex-1 overflow-hidden">
        <InboxClient tenantId={tenant.id} initialConversations={conversations} adminUsers={adminUsers} />
      </div>
    </>
  );
}
