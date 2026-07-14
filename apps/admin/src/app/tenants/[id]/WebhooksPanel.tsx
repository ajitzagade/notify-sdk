'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Check, Copy, AlertCircle, Webhook as WebhookIcon, RotateCcw, Plus, Loader2, Trash2 } from 'lucide-react';
import type { WebhookEndpointRecord, WebhookEvent } from '@/lib/webhookEndpoints';

// A plain, inlined constant (not imported as a value from '@/lib/webhookEndpoints') —
// that module also does server-only encryption/DB work, and importing any real
// (non-type) binding from it here would pull the whole thing into the client bundle.
const ALL_WEBHOOK_EVENTS: WebhookEvent[] = ['sent', 'delivered', 'read', 'failed', 'reply'];
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CardTitleGroup } from '@/components/card-title-group';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/lib/toast';

const EVENT_LABEL: Record<WebhookEvent, string> = {
  sent:      'Message sent',
  delivered: 'Delivered',
  read:      'Read',
  failed:    'Failed',
  reply:     'Customer reply',
};

export function WebhooksPanel({ tenantId, endpoints }: { tenantId: string; endpoints: WebhookEndpointRecord[] }) {
  const router = useRouter();
  const [url, setUrl]           = useState('');
  const [events, setEvents]     = useState<WebhookEvent[]>(['sent', 'delivered', 'reply']);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId]     = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [copied, setCopied]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const toggleEvent = (evt: WebhookEvent) => {
    setEvents((prev) => (prev.includes(evt) ? prev.filter((e) => e !== evt) : [...prev, evt]));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setNewSecret(null);
    setCopied(false);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/webhooks`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ url, events }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create endpoint');
      setNewSecret(data.secret);
      setUrl('');
      toast.success('Webhook endpoint created — copy the signing secret now');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (endpointId: string) => {
    setBusyId(endpointId);
    setError(null);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/webhooks/${endpointId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to delete endpoint');
      toast.success('Webhook endpoint deleted');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      toast.error(message);
    } finally {
      setBusyId(null);
    }
  };

  const handleReactivate = async (endpointId: string) => {
    setBusyId(endpointId);
    setError(null);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/webhooks/${endpointId}/reactivate`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to reactivate endpoint');
      toast.success('Webhook endpoint reactivated');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      toast.error(message);
    } finally {
      setBusyId(null);
    }
  };

  const copySecret = async () => {
    if (!newSecret) return;
    await navigator.clipboard.writeText(newSecret);
    setCopied(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitleGroup
          icon={WebhookIcon}
          title="Outbound webhooks"
          description={<>Push sent/delivered/read/failed/reply events to your own systems the moment they happen — HMAC-signed, no polling.</>}
        />
      </CardHeader>
      <CardContent className="grid gap-4">
        <form onSubmit={handleCreate} className="grid max-w-2xl gap-3 rounded-lg border bg-muted/30 p-4">
          <div className="grid gap-2">
            <Label htmlFor="webhook-url">Endpoint URL</Label>
            <Input
              id="webhook-url"
              type="url"
              required
              placeholder="https://your-server.example.com/webhooks/notify-sdk"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Events</Label>
            <div className="flex flex-wrap gap-4">
              {ALL_WEBHOOK_EVENTS.map((evt) => (
                <label key={evt} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={events.includes(evt)} onCheckedChange={() => toggleEvent(evt)} />
                  {EVENT_LABEL[evt]}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Button type="submit" disabled={creating || events.length === 0}>
              {creating ? <Loader2 className="animate-spin" /> : <Plus />}
              {creating ? 'Creating…' : 'Add endpoint'}
            </Button>
          </div>
        </form>

        {newSecret && (
          <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400">
            <AlertTriangle />
            <AlertDescription className="text-amber-700 dark:text-amber-400">
              <p className="mb-2">Copy this signing secret now — it won&apos;t be shown again.</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md bg-background px-2 py-1 text-xs break-all text-foreground">{newSecret}</code>
                <Button type="button" variant="outline" size="sm" onClick={copySecret}>
                  {copied ? <Check /> : <Copy />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {endpoints.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-muted">
              <WebhookIcon className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">No webhook endpoints yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Add one above to start receiving events.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>URL</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {endpoints.map((ep) => (
                  <TableRow key={ep.id}>
                    <TableCell className="max-w-64 truncate font-mono text-xs">{ep.url}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="flex flex-wrap gap-1">
                        {ep.events.map((evt) => (
                          <Badge key={evt} variant="outline" className="text-[10px]">
                            {EVENT_LABEL[evt]}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {ep.isActive ? (
                        <Badge variant="default">active</Badge>
                      ) : (
                        <Badge variant="destructive" title={`Disabled after ${ep.consecutiveFailures} consecutive failures`}>
                          disabled
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!ep.isActive && (
                          <Button type="button" variant="outline" size="sm" onClick={() => handleReactivate(ep.id)} disabled={busyId === ep.id}>
                            <RotateCcw /> Reactivate
                          </Button>
                        )}
                        <Button type="button" variant="outline" size="sm" onClick={() => handleDelete(ep.id)} disabled={busyId === ep.id}>
                          {busyId === ep.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                          {busyId === ep.id ? 'Working…' : 'Delete'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          An endpoint that fails <span className="font-medium">10 deliveries in a row</span> is disabled automatically
          — reactivate it once your endpoint is back up.
        </p>
      </CardFooter>
    </Card>
  );
}
