'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, CheckCheck, XCircle, Send, Inbox as InboxIcon, RefreshCw, Archive, ArchiveRestore } from 'lucide-react';
import type { ConversationRecord } from '@/lib/conversations';
import type { ThreadMessage } from '@/lib/conversations';
import type { AdminUserSummary } from '@/lib/adminUsers';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/lib/toast';
import { CannedResponsesMenu } from './CannedResponsesMenu';

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function StatusTicks({ status }: { status?: string }) {
  if (status === 'read') return <CheckCheck className="size-3.5 text-primary" />;
  if (status === 'delivered') return <CheckCheck className="size-3.5 text-muted-foreground" />;
  if (status === 'failed') return <XCircle className="size-3.5 text-destructive" />;
  return <Check className="size-3.5 text-muted-foreground" />;
}

export function InboxClient({
  tenantId,
  initialConversations,
  adminUsers,
  baseApiPath,
  showAssignment = true,
}: {
  tenantId: string;
  initialConversations: ConversationRecord[];
  adminUsers: AdminUserSummary[];
  baseApiPath?: string;
  /** Assigning to an internal ops teammate is an admin-only concept — the tenant portal hides this control. */
  showAssignment?: boolean;
}) {
  const apiBase = baseApiPath ?? `/api/tenants/${tenantId}`;
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(initialConversations[0]?.id ?? null);
  const [selected, setSelected] = useState<ConversationRecord | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [refreshingList, setRefreshingList] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const refreshList = async () => {
    setRefreshingList(true);
    try {
      const res = await fetch(`${apiBase}/inbox/conversations`);
      const data = await res.json();
      if (res.ok) setConversations(data.conversations);
    } finally {
      setRefreshingList(false);
    }
  };

  const openConversation = async (id: string) => {
    setSelectedId(id);
    setLoadingThread(true);
    try {
      const res = await fetch(`${apiBase}/inbox/conversations/${id}/messages`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load conversation');
      setSelected(data.conversation);
      setMessages(data.messages);
      // Reading it clears the unread dot in the list without a full refetch.
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, hasUnread: false } : c)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingThread(false);
    }
  };

  useEffect(() => {
    if (selectedId) openConversation(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !replyText.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`${apiBase}/inbox/conversations/${selected.id}/reply`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text: replyText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Send failed');
      setReplyText('');
      await openConversation(selected.id);
      await refreshList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  const handleAssign = async (adminId: string) => {
    // No portal-side /assign route exists — assignment is an admin-only
    // concept. showAssignment already hides the only UI that calls this,
    // but guard here too so a future caller can't silently 404 against it.
    if (!showAssignment || !selected) return;
    const value = adminId === '__unassigned__' ? null : adminId;
    try {
      const res = await fetch(`${apiBase}/inbox/conversations/${selected.id}/assign`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ adminId: value }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to assign');
      const email = adminUsers.find((a) => a.id === value)?.email ?? null;
      setSelected((prev) => (prev ? { ...prev, assignedAdminId: value, assignedAdminEmail: email } : prev));
      toast.success(value ? `Assigned to ${email}` : 'Unassigned');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const handleToggleStatus = async () => {
    if (!selected) return;
    const nextStatus = selected.status === 'open' ? 'closed' : 'open';
    try {
      const res = await fetch(`${apiBase}/inbox/conversations/${selected.id}/status`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to update status');
      setSelected((prev) => (prev ? { ...prev, status: nextStatus } : prev));
      setConversations((prev) => prev.map((c) => (c.id === selected.id ? { ...c, status: nextStatus } : c)));
      toast.success(nextStatus === 'closed' ? 'Conversation closed' : 'Conversation reopened');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const sortedConversations = useMemo(
    () => [...conversations].sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()),
    [conversations]
  );

  return (
    <div className="flex h-full">
      {/* Conversation list */}
      <div className="flex w-80 shrink-0 flex-col border-r border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Conversations · {conversations.length}
          </span>
          <Button type="button" variant="ghost" size="icon-sm" onClick={refreshList} disabled={refreshingList}>
            <RefreshCw className={refreshingList ? 'animate-spin' : ''} />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sortedConversations.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
              <div className="flex size-11 items-center justify-center rounded-full bg-muted">
                <InboxIcon className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No conversations yet — they&apos;ll show up here as customers reply.</p>
            </div>
          ) : (
            sortedConversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => openConversation(c.id)}
                className={`flex w-full items-start gap-2.5 border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted ${
                  selectedId === c.id ? 'bg-muted/70' : ''
                }`}
              >
                <Avatar className="size-8 shrink-0">
                  <AvatarFallback color={null}>{(c.contactName ?? c.contactPhone).slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{c.contactName ?? c.contactPhone}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{formatRelativeTime(c.lastMessageAt)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    {c.hasUnread && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                    {c.status === 'closed' && <Badge variant="outline" className="text-[10px]">closed</Badge>}
                    {c.assignedAdminEmail && (
                      <span className="truncate text-[11px] text-muted-foreground">→ {c.assignedAdminEmail}</span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Thread */}
      <div className="flex flex-1 flex-col">
        {!selected ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Select a conversation to view it
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{selected.contactName ?? selected.contactPhone}</div>
                <div className="font-mono text-xs text-muted-foreground">{selected.contactPhone}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {showAssignment && (
                  <Select
                    value={selected.assignedAdminId ?? '__unassigned__'}
                    onValueChange={(v) => v && handleAssign(v)}
                    // items map so the trigger shows the admin's email, not the raw UUID
                    items={{ __unassigned__: 'Unassigned', ...Object.fromEntries(adminUsers.map((a) => [a.id, a.email])) }}
                  >
                    <SelectTrigger className="w-44"><SelectValue placeholder="Assign to…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__unassigned__">Unassigned</SelectItem>
                      {adminUsers.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button type="button" variant="outline" size="sm" onClick={handleToggleStatus}>
                  {selected.status === 'open' ? <Archive /> : <ArchiveRestore />}
                  {selected.status === 'open' ? 'Close' : 'Reopen'}
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {loadingThread ? (
                <div className="grid gap-3">
                  <Skeleton className="h-12 w-2/3 rounded-lg" />
                  <Skeleton className="ml-auto h-12 w-2/3 rounded-lg" />
                  <Skeleton className="h-12 w-1/2 rounded-lg" />
                </div>
              ) : (
                <div className="grid gap-3">
                  {messages.map((m) => (
                    <div key={m.id} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                          m.direction === 'outbound' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.body ?? (m.buttonTitle ? `[Button: ${m.buttonTitle}]` : `[${m.kind}]`)}</p>
                        <div
                          className={`mt-1 flex items-center gap-1 text-[10px] ${
                            m.direction === 'outbound' ? 'justify-end text-primary-foreground/70' : 'text-muted-foreground'
                          }`}
                        >
                          {new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {m.direction === 'outbound' && <StatusTicks status={m.status} />}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleSend} className="flex items-end gap-2 border-t border-border p-4">
              <CannedResponsesMenu apiBase={apiBase} onInsert={(body) => setReplyText((prev) => (prev ? `${prev} ${body}` : body))} />
              <Textarea
                rows={1}
                placeholder="Type a reply…"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e as unknown as React.FormEvent);
                  }
                }}
                className="min-h-9 flex-1 resize-none"
              />
              <Button type="submit" disabled={sending || !replyText.trim()}>
                <Send /> {sending ? 'Sending…' : 'Send'}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
