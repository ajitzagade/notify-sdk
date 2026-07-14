'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, AlertCircle, LayoutTemplate } from 'lucide-react';
import type { TemplateRecord } from '@/lib/templates';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CardTitleGroup } from '@/components/card-title-group';
import { HelpSteps } from '@/components/help-steps';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/lib/toast';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  APPROVED: 'default',
  PENDING:  'secondary',
  REJECTED: 'destructive',
};

export function TemplatesPanel({
  tenantId, templates, baseApiPath,
}: { tenantId: string; templates: TemplateRecord[]; baseApiPath?: string }) {
  const apiBase = baseApiPath ?? `/api/tenants/${tenantId}`;
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/templates/sync`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Sync failed');
      toast.success(`Synced ${data.count ?? 0} template(s) from Meta`);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      toast.error(message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitleGroup
          icon={LayoutTemplate}
          title="WhatsApp templates"
          description="Meta-approved templates — required to message anyone outside the 24-hour session window."
        />
        <CardAction>
          <Button type="button" variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : 'Sync from Meta'}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {templates.length === 0 ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <div className="flex size-11 items-center justify-center rounded-full bg-muted">
                <LayoutTemplate className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">No templates synced yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Use &quot;Sync from Meta&quot; above to pull in this tenant&apos;s approved templates.</p>
              </div>
            </div>
            <HelpSteps
              title="Creating templates"
              intro="Templates are authored and approved on Meta's side — this page only pulls in what's already approved."
              steps={[
                {
                  text: <>Open <b>WhatsApp Manager → Message templates</b> for this tenant&apos;s business account.</>,
                  href: 'https://business.facebook.com/wa/manage/message-templates/',
                  hrefLabel: 'WhatsApp Manager',
                },
                { text: <>Create a template — pick a category (<b>Marketing</b>, <b>Utility</b>, or <b>Authentication</b>), a language, and write the body. Use <code>{'{{1}}'}</code>, <code>{'{{2}}'}</code>… for values filled at send time.</> },
                { text: <>Submit it — Meta usually reviews within minutes to a few hours.</> },
                { text: <>Once approved, make sure the <b>Business Account ID</b> is saved on the Credentials step, then hit <b>Sync from Meta</b> here.</> },
              ]}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-muted-foreground">{t.language}</TableCell>
                    <TableCell className="text-muted-foreground">{t.category}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[t.status] ?? 'outline'}>{t.status}</Badge>
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
