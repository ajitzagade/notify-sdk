'use client';

import { useEffect, useState } from 'react';
import { MessageSquareText, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import type { CannedResponse } from '@/lib/cannedResponses';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/lib/toast';

/**
 * Quick-insert menu for the Inbox composer, plus the add/edit/delete
 * management UI for a tenant's snippet list. Inserting never sends —
 * it just fills the reply textarea so the agent can still edit before
 * hitting Send, same as every other canned-response tool works.
 */
export function CannedResponsesMenu({
  apiBase, onInsert,
}: { apiBase: string; onInsert: (body: string) => void }) {
  const [responses, setResponses] = useState<CannedResponse[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

  const load = async () => {
    try {
      const res = await fetch(`${apiBase}/canned-responses`);
      const data = await res.json();
      if (res.ok) setResponses(data.responses);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => { load(); }, [apiBase]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button type="button" variant="outline" size="icon" title="Canned responses">
              <MessageSquareText />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="w-64">
          {!loaded ? (
            <div className="flex items-center justify-center py-4"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>
          ) : responses.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">No canned responses yet.</p>
          ) : (
            responses.map((r) => (
              <DropdownMenuItem key={r.id} onClick={() => onInsert(r.body)}>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{r.label}</div>
                  <div className="truncate text-xs text-muted-foreground">{r.body}</div>
                </div>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setManageOpen(true)}>
            <Pencil /> Manage canned responses
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ManageCannedResponsesDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        apiBase={apiBase}
        responses={responses}
        onChange={load}
      />
    </>
  );
}

function ManageCannedResponsesDialog({
  open, onOpenChange, apiBase, responses, onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apiBase: string;
  responses: CannedResponse[];
  onChange: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const startNew = () => { setEditingId(null); setLabel(''); setBody(''); };
  const startEdit = (r: CannedResponse) => { setEditingId(r.id); setLabel(r.label); setBody(r.body); };

  const handleSave = async () => {
    if (!label.trim() || !body.trim()) return;
    setSaving(true);
    try {
      const url = editingId ? `${apiBase}/canned-responses/${editingId}` : `${apiBase}/canned-responses`;
      const res = await fetch(url, {
        method:  editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ label: label.trim(), body: body.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      toast.success(editingId ? 'Canned response updated' : 'Canned response added');
      startNew();
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`${apiBase}/canned-responses/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Delete failed');
      if (editingId === id) startNew();
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Canned responses</DialogTitle>
          <DialogDescription>Quick-insert snippets for replies you send often.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 max-h-64 overflow-y-auto">
          {responses.length === 0 && <p className="text-sm text-muted-foreground">None yet — add your first below.</p>}
          {responses.map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-2 rounded-lg border border-border p-2.5">
              <div className="min-w-0">
                <div className="text-sm font-medium">{r.label}</div>
                <div className="line-clamp-2 text-xs text-muted-foreground">{r.body}</div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => startEdit(r)}><Pencil /></Button>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => handleDelete(r.id)}><Trash2 /></Button>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-2 border-t border-border pt-3">
          <Label htmlFor="canned-label">{editingId ? 'Edit snippet' : 'New snippet'}</Label>
          <Input id="canned-label" placeholder="Label — e.g. Business hours" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Textarea placeholder="The message text to insert" rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>

        <DialogFooter>
          {editingId && <Button type="button" variant="outline" onClick={startNew}>Cancel edit</Button>}
          <Button type="button" onClick={handleSave} disabled={saving || !label.trim() || !body.trim()}>
            {saving ? <Loader2 className="animate-spin" /> : <Plus />}
            {editingId ? 'Save changes' : 'Add snippet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
