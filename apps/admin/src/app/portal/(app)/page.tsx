import Link from 'next/link';
import {
  Send, Eye, Inbox as InboxIcon, ArrowRight, Megaphone,
  CheckCheck, LayoutGrid, Upload, type LucideIcon,
} from 'lucide-react';
import { requirePortalSessionOrRedirect } from '@/lib/tenantPortalAuth';
import { getTenant } from '@/lib/tenants';
import { getTenantRollup, getDailyActivity } from '@/lib/analytics';
import { listConversations } from '@/lib/conversations';
import { listCampaigns } from '@/lib/campaigns';
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ActivityChart } from '@/components/activity-chart';
import { PageTitle } from '@/components/page-title';

function pct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

function relativeTime(ts: string): string {
  const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function StatCard({ icon: Icon, label, value, sub, accent }: {
  icon: LucideIcon; label: string; value: string; sub?: string; accent: string;
}) {
  return (
    <div className="rounded-xl border-l-2 bg-card p-4 shadow-sm ring-1 ring-foreground/[0.07]" style={{ borderLeftColor: accent }}>
      <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums leading-tight">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

const CAMPAIGN_STATUS_VARIANT: Record<string, 'outline' | 'secondary' | 'default' | 'destructive'> = {
  draft: 'outline', running: 'secondary', completed: 'default', failed: 'destructive',
};

export default async function PortalDashboardPage() {
  const session = requirePortalSessionOrRedirect();
  const [tenant, rollup, daily, conversations, campaigns] = await Promise.all([
    getTenant(session.tenantId),
    getTenantRollup(session.tenantId),
    getDailyActivity(session.tenantId),
    listConversations(session.tenantId),
    listCampaigns(session.tenantId),
  ]);

  const openChats = conversations.filter((c) => c.status === 'open');
  const unread = openChats.filter((c) => c.hasUnread).length;
  const recentConversations = conversations.slice(0, 5);
  const recentCampaigns = campaigns.slice(0, 4);

  return (
    <>
      <header className="flex items-center justify-between gap-4 border-b border-border px-8 py-5">
        <PageTitle
          icon={LayoutGrid}
          title={`Welcome back${tenant ? `, ${tenant.name}` : ''}`}
          description="Everything that happened across your WhatsApp channel, at a glance."
        />
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" render={<Link href="/portal/campaigns" />}>
            <Upload /> Import contacts
          </Button>
          <Button size="sm" render={<Link href="/portal/campaigns" />}>
            <Megaphone /> New campaign
          </Button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-8 py-8">
        <div className="grid gap-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon={Send} label="Messages sent" value={rollup.sent.toLocaleString()} accent="var(--primary)" />
            <StatCard icon={CheckCheck} label="Delivery rate" value={pct(rollup.deliveryRate)} sub={`${rollup.delivered.toLocaleString()} delivered`} accent="var(--signal)" />
            <StatCard icon={Eye} label="Read rate" value={pct(rollup.readRate)} sub={`${rollup.read.toLocaleString()} read`} accent="var(--chart-3)" />
            <StatCard icon={InboxIcon} label="Open chats" value={String(openChats.length)} sub={unread > 0 ? `${unread} unread` : 'all caught up'} accent="var(--primary-2)" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Message activity</CardTitle>
              <CardAction>
                <Button variant="ghost" size="sm" render={<Link href="/portal/analytics" />}>
                  Full analytics <ArrowRight />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <ActivityChart data={daily} />
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent conversations</CardTitle>
                <CardAction>
                  <Button variant="ghost" size="sm" render={<Link href="/portal/inbox" />}>
                    Open inbox <ArrowRight />
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent>
                {recentConversations.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No conversations yet — replies to your messages will show up here.
                  </p>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {recentConversations.map((c) => (
                      <li key={c.id}>
                        <Link href="/portal/inbox" className="flex items-center gap-3 py-2.5 transition-colors hover:bg-muted/40">
                          <Avatar className="size-8 shrink-0">
                            <AvatarFallback className="text-xs">
                              {(c.contactName ?? c.contactPhone).slice(0, 1).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium">{c.contactName ?? c.contactPhone}</span>
                              {c.hasUnread && <span aria-label="unread" className="size-1.5 shrink-0 rounded-full bg-primary" />}
                            </div>
                            <div className="font-mono text-xs text-muted-foreground">{c.contactPhone}</div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className="text-xs text-muted-foreground">{relativeTime(c.lastMessageAt)}</span>
                            {c.status === 'closed' && <Badge variant="outline">closed</Badge>}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Campaigns</CardTitle>
                <CardAction>
                  <Button variant="ghost" size="sm" render={<Link href="/portal/campaigns" />}>
                    All campaigns <ArrowRight />
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent>
                {recentCampaigns.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No campaigns yet — create one from the Campaigns page to broadcast a template.
                  </p>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {recentCampaigns.map((c) => (
                      <li key={c.id}>
                        <Link href="/portal/campaigns" className="flex items-center gap-3 py-2.5 transition-colors hover:bg-muted/40">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Megaphone className="size-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{c.name}</div>
                            <div className="text-xs text-muted-foreground">
                              <code>{c.hsmTemplateName}</code> · {relativeTime(c.createdAt)}
                            </div>
                          </div>
                          <Badge variant={CAMPAIGN_STATUS_VARIANT[c.status] ?? 'outline'}>{c.status}</Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
