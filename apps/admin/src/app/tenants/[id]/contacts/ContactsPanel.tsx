'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Users, AlertCircle, Save, Loader2 } from 'lucide-react';
import type { ContactRecord } from '@/lib/contacts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/lib/toast';

const ALL_TAGS_VALUE = '__all__';

function parseAttributesInput(raw: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const line of raw.split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) result[key] = value;
  }
  return result;
}

function formatAttributesInput(attributes: Record<string, unknown>): string {
  return Object.entries(attributes)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join('\n');
}

export function ContactsPanel({
  tenantId,
  initialContacts,
  allTags,
  baseApiPath,
}: {
  tenantId: string;
  initialContacts: ContactRecord[];
  allTags: string[];
  baseApiPath?: string;
}) {
  const apiBase = baseApiPath ?? `/api/tenants/${tenantId}`;
  const router = useRouter();
  const [contacts, setContacts] = useState(initialContacts);
  const [tagFilter, setTagFilter] = useState<string>(ALL_TAGS_VALUE);
  const [loading, setLoading] = useState(false);

  const [editing, setEditing] = useState<ContactRecord | null>(null);
  const [tagsInput, setTagsInput] = useState('');
  const [attributesInput, setAttributesInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyFilter = async (tag: string) => {
    setTagFilter(tag);
    setLoading(true);
    try {
      const qs = tag === ALL_TAGS_VALUE ? '' : `?tag=${encodeURIComponent(tag)}`;
      const res = await fetch(`${apiBase}/contacts${qs}`);
      const data = await res.json();
      if (res.ok) setContacts(data.contacts);
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (contact: ContactRecord) => {
    setEditing(contact);
    setTagsInput(contact.tags.join(', '));
    setAttributesInput(formatAttributesInput(contact.attributes));
    setError(null);
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
      const attributes = parseAttributesInput(attributesInput);
      const res = await fetch(`${apiBase}/contacts/${editing.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tags, attributes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save');
      setContacts((prev) => prev.map((c) => (c.id === editing.id ? data.contact : c)));
      toast.success('Contact updated');
      setEditing(null);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>Contacts</CardTitle>
            <CardDescription>Everyone imported for this tenant, with tags and custom fields.</CardDescription>
          </div>
          <Select value={tagFilter} onValueChange={(v) => v && applyFilter(v)}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Filter by tag…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TAGS_VALUE}>All tags</SelectItem>
              {allTags.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-muted">
              <Users className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              {tagFilter === ALL_TAGS_VALUE ? 'No contacts imported yet.' : 'No contacts carry this tag.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{c.phone}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {c.tags.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          c.tags.map((t) => (
                            <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button type="button" variant="outline" size="sm" onClick={() => openEdit(c)}>
                        <Pencil /> Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editing?.name ?? editing?.phone}</DialogTitle>
            <DialogDescription>Tags and custom fields for this contact.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="contact-tags">Tags (comma-separated)</Label>
              <Input
                id="contact-tags"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="vip, wholesale"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact-attrs">Custom fields (one per line: key: value)</Label>
              <Textarea
                id="contact-attrs"
                rows={4}
                value={attributesInput}
                onChange={(e) => setAttributesInput(e.target.value)}
                placeholder={'company: Acme Corp\nloyalty_tier: gold'}
                className="font-mono text-xs"
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
