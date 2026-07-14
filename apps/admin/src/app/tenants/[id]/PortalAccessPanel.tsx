'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, UserRound } from 'lucide-react';
import type { PortalUserRecord } from '@/lib/tenantPortalUsers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/lib/toast';

export function PortalAccessPanel({ tenantId, users }: { tenantId: string; users: PortalUserRecord[] }) {
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/portal-users`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create login');
      toast.success(`Portal login created for ${email}`);
      setEmail('');
      setPassword('');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (userId: string, nextActive: boolean) => {
    setTogglingId(userId);
    setError(null);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/portal-users/${userId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ isActive: nextActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to update');
      toast.success(nextActive ? 'Login reactivated' : 'Login deactivated');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      toast.error(message);
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portal access</CardTitle>
        <CardDescription>
          Logins for this tenant&apos;s own team — they can see Analytics, Campaigns, Contacts, Templates, and the
          Inbox at <code>/portal</code>, scoped to this tenant only. They never see Credentials, API Keys, or any
          other tenant.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form onSubmit={handleCreate} className="flex flex-wrap gap-2">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-w-48 flex-1"
            required
          />
          <div className="grid gap-1">
            <Input
              type="password"
              placeholder="Temporary password (min 8 chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="min-w-56"
              minLength={8}
              required
            />
          </div>
          <Button type="submit" disabled={creating}>
            {creating ? 'Creating…' : 'Create login'}
          </Button>
        </form>

        {error && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {users.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-muted">
              <UserRound className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">No portal logins yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Create one above to give this tenant&apos;s team direct access.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Last login</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.email}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'never'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Badge variant={u.isActive ? 'default' : 'secondary'}>{u.isActive ? 'active' : 'deactivated'}</Badge>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={togglingId === u.id}
                          onClick={() => handleToggleActive(u.id, !u.isActive)}
                        >
                          {togglingId === u.id ? 'Working…' : u.isActive ? 'Deactivate' : 'Reactivate'}
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
    </Card>
  );
}
