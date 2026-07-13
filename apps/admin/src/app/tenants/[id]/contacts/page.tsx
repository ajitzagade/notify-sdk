import { notFound } from 'next/navigation';
import { requireAdminSessionOrRedirect } from '@/lib/auth';
import { getTenant } from '@/lib/tenants';
import { listContacts, listDistinctTags } from '@/lib/contacts';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { ContactsPanel } from './ContactsPanel';

export default async function ContactsPage({ params }: { params: { id: string } }) {
  requireAdminSessionOrRedirect();
  const tenant = await getTenant(params.id);
  if (!tenant) notFound();

  const [contacts, allTags] = await Promise.all([
    listContacts(tenant.id),
    listDistinctTags(tenant.id),
  ]);

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <Breadcrumb
          className="mb-3"
          items={[
            { label: 'Tenants', href: '/tenants' },
            { label: tenant.name, href: `/tenants/${tenant.id}` },
            { label: 'Contacts' },
          ]}
        />
        <h1 className="text-lg font-semibold tracking-tight">Contacts</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Tags and custom fields for {tenant.name}&apos;s contacts.</p>
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-8 py-8">
        <ContactsPanel tenantId={tenant.id} initialContacts={contacts} allTags={allTags} />
      </div>
    </>
  );
}
