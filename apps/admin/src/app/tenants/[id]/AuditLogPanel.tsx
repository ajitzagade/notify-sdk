import { History } from 'lucide-react';
import type { AuditLogEntry } from '@/lib/auditLog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CardTitleGroup } from '@/components/card-title-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const ACTION_LABEL: Record<string, string> = {
  'tenant.created':              'Tenant created',
  'tenant.branding.updated':     'Branding updated',
  'tenant.credentials.updated':  'WhatsApp credentials updated',
  'tenant.api_key.created':      'API key created',
  'tenant.api_key.revoked':      'API key revoked',
  'tenant.ai_config.updated':    'AI assistant settings updated',
  'tenant.webhook.created':      'Webhook endpoint created',
  'tenant.webhook.deleted':      'Webhook endpoint deleted',
  'tenant.webhook.reactivated':  'Webhook endpoint reactivated',
};

export function AuditLogPanel({ entries }: { entries: AuditLogEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitleGroup icon={History} title="Audit log" description="Who changed what for this tenant, and when." />
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-muted">
              <History className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">No activity recorded yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Credential rotations, branding edits, and API key changes will show up here.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead className="text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{ACTION_LABEL[e.action] ?? e.action}</TableCell>
                    <TableCell className="text-muted-foreground">{e.adminEmail ?? 'unknown admin'}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {new Date(e.createdAt).toLocaleString()}
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
