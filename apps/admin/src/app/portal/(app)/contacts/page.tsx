import { Users } from 'lucide-react';
import { PageTitle } from '@/components/page-title';
import { requirePortalSessionOrRedirect } from '@/lib/tenantPortalAuth';
import { listContacts, listDistinctTags } from '@/lib/contacts';
import { ContactsPanel } from '@/app/tenants/[id]/contacts/ContactsPanel';

export default async function PortalContactsPage() {
  const session = requirePortalSessionOrRedirect();

  const [contacts, allTags] = await Promise.all([
    listContacts(session.tenantId),
    listDistinctTags(session.tenantId),
  ]);

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <PageTitle icon={Users} title="Contacts" description={"Tags and custom fields for your contacts."} />
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-8 py-8">
        <ContactsPanel tenantId={session.tenantId} initialContacts={contacts} allTags={allTags} baseApiPath="/api/portal" />
      </div>
    </>
  );
}
