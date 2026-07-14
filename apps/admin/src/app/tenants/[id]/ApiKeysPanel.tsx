'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Check, Copy, AlertCircle, KeyRound, Plus, Loader2, Ban } from 'lucide-react';
import type { ApiKeyRecord } from '@/lib/apiKeys';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from '@/lib/toast';

export function ApiKeysPanel({ tenantId, apiKeys }: { tenantId: string; apiKeys: ApiKeyRecord[] }) {
  const router = useRouter();
  const [label, setLabel]         = useState('');
  const [creating, setCreating]   = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [newKey, setNewKey]       = useState<string | null>(null);
  const [copied, setCopied]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setNewKey(null);
    setCopied(false);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/api-keys`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ label: label || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create key');
      setNewKey(data.fullKey);
      setLabel('');
      toast.success('New API key created — copy it now, it won’t be shown again');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    setRevokingId(keyId);
    setError(null);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/api-keys/${keyId}/revoke`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to revoke key');
      toast.success('API key revoked');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      toast.error(message);
    } finally {
      setRevokingId(null);
    }
  };

  const copyKey = async () => {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    setCopied(true);
    toast.success('Key copied to clipboard');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>API keys</CardTitle>
        <CardDescription>
          For this tenant&apos;s own backend to send messages programmatically via <code>POST /v1/send</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form onSubmit={handleCreate} className="flex gap-2">
          <Input
            placeholder="Label (optional, e.g. production backend)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={creating}>
            {creating ? <Loader2 className="animate-spin" /> : <Plus />}
            {creating ? 'Creating…' : 'New key'}
          </Button>
        </form>

        {newKey && (
          <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400">
            <AlertTriangle />
            <AlertDescription className="text-amber-700 dark:text-amber-400">
              <p className="mb-2">Copy this now — it won&apos;t be shown again.</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md bg-background px-2 py-1 text-xs break-all text-foreground">{newKey}</code>
                <Button type="button" variant="outline" size="sm" onClick={copyKey}>
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

        {apiKeys.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-muted">
              <KeyRound className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">No API keys yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Create one above so this tenant&apos;s backend can call the API directly.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell><code>nsk_{k.keyPrefix}…</code></TableCell>
                    <TableCell className="text-muted-foreground">{k.label ?? 'unlabeled'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'never used'}
                    </TableCell>
                    <TableCell className="text-right">
                      {k.revokedAt ? (
                        <span className="text-xs text-destructive">revoked</span>
                      ) : (
                        <AlertDialog>
                          <AlertDialogTrigger render={<Button variant="outline" size="sm" disabled={revokingId === k.id} />}>
                            {revokingId === k.id ? <Loader2 className="animate-spin" /> : <Ban />}
                            {revokingId === k.id ? 'Revoking…' : 'Revoke'}
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Revoke this API key?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Any backend using <code>nsk_{k.keyPrefix}…</code> will immediately start getting 401s. This can&apos;t be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction variant="destructive" onClick={() => handleRevoke(k.id)}>
                                Revoke key
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
