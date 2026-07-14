'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, Upload, Loader2, FileSpreadsheet, Download } from 'lucide-react';
import type { BroadcastListRecord } from '@/lib/broadcastLists';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CardTitleGroup } from '@/components/card-title-group';
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
  // Remount key clears the file input after a read — the shadcn Input wrapper
  // doesn't forward refs under React 18, so `ref.value = ''` isn't an option.
  const [fileInputKey, setFileInputKey]   = useState(0);
  const [fileNote, setFileNote]           = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      // Tolerate a header row — drop it if the first line looks like column names.
      .filter((l, i) => !(i === 0 && /^phone\b/i.test(l.replace(/["']/g, ''))))
      .map((l) => l.replace(/["']/g, ''));
    setCsv(lines.join('\n'));
    setFileNote(`Loaded ${lines.length} row(s) from ${file.name} — review below, then import.`);
    setFileInputKey((k) => k + 1);
  };

  const downloadTemplate = () => {
    const sample = 'phone,name\n919876543210,Priya Sharma\n919123456789,Rahul Verma\n14155550123,Sam Carter\n';
    const url = URL.createObjectURL(new Blob([sample], { type: 'text/csv' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'contacts-template.csv' });
    a.click();
    URL.revokeObjectURL(url);
  };

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
        <CardTitleGroup
          icon={Upload}
          title="Import contacts"
          description="Upload a CSV or paste rows — every contact lands in the broadcast list you pick."
        />
      </CardHeader>
      <CardContent>
        <form id="import-contacts-form" onSubmit={handleImport} className="grid max-w-2xl gap-4">
          <div className="grid gap-2">
            <Label htmlFor="contacts-file">Bulk upload a CSV file</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                key={fileInputKey}
                id="contacts-file"
                type="file"
                accept=".csv,text/csv"
                className="max-w-xs"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
                <Download /> CSV template
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Columns: <code>phone,name</code> — one contact per row, header row optional. The file fills the box below so you can review before importing.
            </p>
            {fileNote && (
              <p className="flex items-center gap-1.5 text-xs text-signal">
                <FileSpreadsheet className="size-3.5" /> {fileNote}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="contacts-csv">Contacts (or paste them here directly)</Label>
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
            <Alert variant={result.ok ? 'success' : 'destructive'}>
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
