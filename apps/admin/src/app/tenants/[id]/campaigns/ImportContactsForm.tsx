'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, Upload, Loader2 } from 'lucide-react';
import type { BroadcastListRecord } from '@/lib/broadcastLists';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/lib/toast';

export function ImportContactsForm({
  tenantId, lists, baseApiPath,
}: { tenantId: string; lists: BroadcastListRecord[]; baseApiPath?: string }) {
  const apiBase = baseApiPath ?? `/api/tenants/${tenantId}`;
  const router = useRouter();
  const [csv, setCsv]                     = useState('');
  const [listName, setListName]           = useState('');
  const [tagsInput, setTagsInput]         = useState('');
  const [alreadyOptedIn, setAlreadyOptedIn] = useState(false);
  const [importing, setImporting]         = useState(false);
  const [result, setResult]               = useState<{ ok: boolean; text: string } | null>(null);

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setImporting(true);
    setResult(null);
    try {
      const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
      const res = await fetch(`${apiBase}/contacts/import`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ csv, listName, alreadyOptedIn, tags }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Import failed');
      const text = `Imported ${data.imported} contact(s) into "${data.list.name}"${data.optedIn ? ' (marked opted-in)' : ''}.`;
      setResult({ ok: true, text });
      toast.success(text, 'Contacts imported');
      setCsv('');
      setTagsInput('');
      router.refresh();
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      setResult({ ok: false, text });
      toast.error(text);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import contacts</CardTitle>
        <CardDescription>
          One contact per line: <code>phone,name</code> (name optional). Adds them all to a broadcast list.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form id="import-contacts-form" onSubmit={handleImport} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="contacts-csv">Contacts CSV</Label>
            <Textarea
              id="contacts-csv"
              required
              rows={6}
              placeholder={'919876543210,Priya Sharma\n919123456789,Rahul Verma'}
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              className="font-mono text-xs"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="list-name">Broadcast list name (existing or new)</Label>
            <Input id="list-name" required list="existing-lists" value={listName} onChange={(e) => setListName(e.target.value)} />
            <datalist id="existing-lists">
              {lists.map((l) => <option key={l.id} value={l.name} />)}
            </datalist>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="contact-tags-input">Tags (comma-separated, optional)</Label>
            <Input
              id="contact-tags-input"
              placeholder="vip, wholesale"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Applied to every contact in this batch — merged with any tags they already have.</p>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={alreadyOptedIn}
              onCheckedChange={(checked) => setAlreadyOptedIn(checked === true)}
              className="mt-0.5"
            />
            <span>These contacts already consented to WhatsApp messages elsewhere (marks them opted-in — no message is sent)</span>
          </label>

          {result && (
            <Alert variant={result.ok ? 'default' : 'destructive'}>
              {result.ok ? <CheckCircle2 /> : <XCircle />}
              <AlertDescription>{result.text}</AlertDescription>
            </Alert>
          )}
        </form>

        {lists.length > 0 && (
          <div className="mt-5 grid gap-2">
            <span className="text-xs font-medium text-muted-foreground">Existing lists</span>
            <div className="flex flex-wrap gap-2">
              {lists.map((l) => (
                <Badge key={l.id} variant="outline">
                  {l.name} · {l.memberCount} member{l.memberCount === 1 ? '' : 's'}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button type="submit" form="import-contacts-form" disabled={importing}>
          {importing ? <Loader2 className="animate-spin" /> : <Upload />}
          {importing ? 'Importing…' : 'Import'}
        </Button>
      </CardFooter>
    </Card>
  );
}
