import { Inbox } from 'lucide-react';
import { PageTitle } from '@/components/page-title';
import { requirePortalSessionOrRedirect } from '@/lib/tenantPortalAuth';
import { listConversations } from '@/lib/conversations';
import { InboxClient } from '@/app/tenants/[id]/inbox/InboxClient';

export default async function PortalInboxPage() {
  const session = requirePortalSessionOrRedirect();
  const conversations = await listConversations(session.tenantId);

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <PageTitle icon={Inbox} title="Inbox" description={"Every conversation with your customers, in one place."} />
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
