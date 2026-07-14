'use client';

import { useEffect, useState } from 'react';
import { Loader2, AlertCircle, MessageSquareReply, Users } from 'lucide-react';
import type { CampaignDetail } from '@/lib/campaigns';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { WhatsAppPreview } from '@/components/whatsapp-preview';

const STATUS_VARIANT: Record<string, 'outline' | 'secondary' | 'default' | 'destructive'> = {
  queued:    'outline',
  sent:      'outline',
  delivered: 'secondary',
  read:      'default',
  failed:    'destructive',
};

function fmt(ts: string | null | undefined): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-2 last:border-0">
      <span className="shrink-0 text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className="min-w-0 text-right text-sm">{children}</span>
    </div>
  );
}

/**
 * Full history of one campaign: the message that went out, per-recipient
 * delivery/read outcomes (live from notify_log), and every reply it drew.
 * Shared by the admin console and the tenant portal — `apiBase` decides
 * which surface's API it reads from.
 */
export function CampaignDetailSheet({
  apiBase, tenantName, campaignId, onClose,
}: {
  apiBase: string;
  tenantName: string;
  /** null keeps the sheet closed; an id opens it and triggers the fetch. */
  campaignId: string | null;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!campaignId) return;
    setDetail(null);
    setError(null);
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/campaigns/${campaignId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Failed to load campaign');
        if (!cancelled) setDetail(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => { cancelled = true; };
  }, [apiBase, campaignId]);

  const c = detail?.campaign;

  return (
    <Sheet open={campaignId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl!">
        <SheetHeader>
          <SheetTitle>{c ? c.name : 'Campaign'}</SheetTitle>
          <SheetDescription>
            {c ? `Everything this campaign did, live from the message log.` : 'Loading campaign history…'}
          </SheetDescription>
        </SheetHeader>

        {error && (
          <div className="px-4">
            <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>
          </div>
        )}

        {!detail && !error && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        )}

        {detail && c && (
          <div className="grid gap-6 px-4 pb-6">
            <div>
              <SummaryRow label="Status"><Badge variant={c.status === 'completed' ? 'default' : c.status === 'failed' ? 'destructive' : 'outline'}>{c.status}</Badge></SummaryRow>
              <SummaryRow label="Template"><code className="text-xs">{c.hsmTemplateName}</code> · {c.hsmLanguage}</SummaryRow>
              {c.hsmParams.length > 0 && (
                <SummaryRow label="Parameters">{c.hsmParams.map((p, i) => <Badge key={i} variant="outline" className="ml-1">{p}</Badge>)}</SummaryRow>
              )}
              {c.headerMediaUrl && (
                <SummaryRow label="Header media">
                  <a href={c.headerMediaUrl} target="_blank" rel="noreferrer" className="text-primary underline-offset-2 hover:underline">{c.headerMediaType}</a>
                </SummaryRow>
              )}
              <SummaryRow label="Broadcast list">{detail.listName ?? '—'}</SummaryRow>
              <SummaryRow label="Created by">{detail.createdBy ?? '—'}</SummaryRow>
              <SummaryRow label="Created">{fmt(c.createdAt)}</SummaryRow>
              <SummaryRow label="Completed">{fmt(c.completedAt)}</SummaryRow>
            </div>

            {detail.messagePreview && (
              <div className="grid gap-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Message sent</span>
                <WhatsAppPreview
                  senderName={tenantName}
                  body={detail.messagePreview}
                  mediaUrl={c.headerMediaUrl}
                  mediaKind={c.headerMediaType}
                />
              </div>
            )}

            <div className="grid gap-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <Users className="size-3.5" /> Recipients · {detail.recipients.length}
              </span>
              {detail.recipients.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {c.status === 'draft' ? 'Not run yet — no messages have been sent.' : 'No per-recipient log rows found for this run.'}
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contact</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Last update</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.recipients.map((r) => (
                        <TableRow key={r.phone}>
                          <TableCell>
                            <div className="font-medium">{r.name ?? '—'}</div>
                            <div className="font-mono text-xs text-muted-foreground">{r.phone}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={STATUS_VARIANT[r.status] ?? 'outline'}>{r.status}</Badge>
                            {r.errorMessage && <div className="mt-1 max-w-52 text-xs whitespace-normal text-destructive">{r.errorMessage}</div>}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {fmt(r.readAt ?? r.deliveredAt ?? r.sentAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <MessageSquareReply className="size-3.5" /> Replies · {detail.replies.length}
              </span>
              {detail.replies.length === 0 ? (
                <p className="text-sm text-muted-foreground">No one has replied to this campaign.</p>
              ) : (
                <div className="grid gap-2">
                  {detail.replies.map((r, i) => (
                    <div key={i} className="rounded-lg border bg-muted/30 px-3 py-2">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-xs font-medium">{r.name ?? r.phone}</span>
                        <span className="text-xs text-muted-foreground">{fmt(r.receivedAt)}</span>
                      </div>
                      <p className="mt-0.5 text-sm">
                        {r.type === 'button' ? <Badge variant="secondary">{r.buttonTitle}</Badge> : r.body}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
