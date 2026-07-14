import { requirePortalSessionOrRedirect } from '@/lib/tenantPortalAuth';
import { listConversations } from '@/lib/conversations';
import { InboxClient } from '@/app/tenants/[id]/inbox/InboxClient';

export default async function PortalInboxPage() {
  const session = requirePortalSessionOrRedirect();
  const conversations = await listConversations(session.tenantId);

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <h1 className="text-lg font-semibold tracking-tight">Inbox</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Every conversation with your customers, in one place.</p>
      </header>

      <div className="flex-1 overflow-hidden">
        <InboxClient
          tenantId={session.tenantId}
          initialConversations={conversations}
          adminUsers={[]}
          baseApiPath="/api/portal"
          showAssignment={false}
        />
      </div>
    </>
  );
}
