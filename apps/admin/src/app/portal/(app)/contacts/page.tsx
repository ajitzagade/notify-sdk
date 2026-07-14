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
        <h1 className="text-lg font-semibold tracking-tight">Contacts</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Tags and custom fields for your contacts.</p>
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-8 py-8">
        <ContactsPanel tenantId={session.tenantId} initialContacts={contacts} allTags={allTags} baseApiPath="/api/portal" />
      </div>
    </>
  );
}
