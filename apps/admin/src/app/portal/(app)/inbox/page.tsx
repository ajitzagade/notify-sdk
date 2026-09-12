import { Inbox } from 'lucide-react';
import { PageTitle } from '@/components/page-title';
import { requirePortalSessionOrRedirect } from '@/lib/tenantPortalAuth';
import { listConversations } from '@/lib/conversations';
import { listPortalUsers } from '@/lib/tenantPortalUsers';
import { InboxClient } from '@/app/tenants/[id]/inbox/InboxClient';

export default async function PortalInboxPage() {
  const session = requirePortalSessionOrRedirect();
  const [conversations, portalUsers] = await Promise.all([
    listConversations(session.tenantId),
    listPortalUsers(session.tenantId),
  ]);

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <PageTitle icon={Inbox} title="Inbox" description={"Every conversation with your customers, in one place. New chats are assigned automatically across your active team."} />
      </header>

      <div className="flex-1 overflow-hidden">
        <InboxClient
          tenantId={session.tenantId}
          initialConversations={conversations}
          adminUsers={[]}
          portalUsers={portalUsers.filter((u) => u.isActive).map((u) => ({ id: u.id, email: u.email }))}
          baseApiPath="/api/portal"
          showAssignment
          assignMode="portal"
        />
      </div>
    </>
  );
}
