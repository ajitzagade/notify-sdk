'use client';

import { useState } from 'react';
import { Loader2, Plus, Pause, Play, Trash2 } from 'lucide-react';
import type { TemplateRecord } from '@/lib/templates';
import type { FollowUpSequenceRecord } from '@/lib/followUpSequences';
import { bodyText, placeholderCount } from '@/lib/templateParams';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/lib/toast';

/**
 * One follow-up per completed campaign (not a multi-step drip chain) — send
 * a second Meta-approved HSM template to anyone who received the original
 * send but never replied, after at least `delayDays` days. Checked once a
 * day by a Vercel Cron job (apps/admin/src/app/api/cron/follow-ups), so
 * delayDays is a floor, not a precise deadline.
 */
export function FollowUpDialog({
  apiBase, campaignId, campaignName, templates, existingFollowUp, open, onOpenChange, onChange,
}: {
  apiBase: string;
  campaignId: string;
  campaignName: string;
  templates: TemplateRecord[];
  existingFollowUp: FollowUpSequenceRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: () => void;
}) {
  const [templateId, setTemplateId] = useState('');
  const [delayDays, setDelayDays]   = useState('3');
  const [params, setParams]         = useState<string[]>([]);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const selectedTemplate = templates.find((t) => t.id === templateId) ?? null;

  const selectTemplate = (id: string | null) => {
    setTemplateId(id ?? '');
    const t = templates.find((x) => x.id === id);
    setParams(t ? new Array(placeholderCount(bodyText(t))).fill('') : []);
  };

  const handleCreate = async () => {
    if (!selectedTemplate) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/campaigns/${campaignId}/follow-up`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delayDays:       Number(delayDays),
          hsmTemplateName: selectedTemplate.name,
          hsmLanguage:     selectedTemplate.language,
          hsmParams:       params,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create follow-up');
      toast.success('Follow-up scheduled');
      onChange();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!existingFollowUp) return;
    try {
      const res = await fetch(`${apiBase}/campaigns/${campaignId}/follow-up`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ isActive: !existingFollowUp.isActive }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Update failed');
      toast.success(existingFollowUp.isActive ? 'Follow-up paused' : 'Follow-up resumed');
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async () => {
    if (!existingFollowUp) return;
    try {
      const res = await fetch(`${apiBase}/campaigns/${campaignId}/follow-up`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Delete failed');
      toast.success('Follow-up removed');
      onChange();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Follow-up for &quot;{campaignName}&quot;</DialogTitle>
          <DialogDescription>
            Sent to anyone who received the original message but never replied, at least this many days later.
          </DialogDescription>
        </DialogHeader>

        {existingFollowUp ? (
          <div className="grid gap-3">
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <code className="text-sm font-semibold">{existingFollowUp.hsmTemplateName}</code>
                <Badge variant={existingFollowUp.isActive ? 'default' : 'outline'}>
                  {existingFollowUp.isActive ? 'Active' : 'Paused'}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Sends {existingFollowUp.delayDays} day{existingFollowUp.delayDays === 1 ? '' : 's'} after the original send, once/day via the platform's daily check.
              </p>
              {existingFollowUp.lastRunAt && (
                <p className="mt-1 text-xs text-muted-foreground">Last checked {new Date(existingFollowUp.lastRunAt).toLocaleString()}</p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleToggleActive}>
                {existingFollowUp.isActive ? <Pause /> : <Play />}
                {existingFollowUp.isActive ? 'Pause' : 'Resume'}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleDelete}>
                <Trash2 /> Remove
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="grid gap-1.5">
              <Label>Follow-up template</Label>
              <Select
                value={templateId}
                onValueChange={selectTemplate}
                items={Object.fromEntries(templates.map((t) => [t.id, `${t.name} (${t.language})`]))}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Choose a template…" /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name} ({t.language})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Send after (days, no reply)</Label>
              <Input type="number" min={1} max={30} value={delayDays} onChange={(e) => setDelayDays(e.target.value)} />
            </div>
            {params.map((val, i) => (
              <div key={i} className="grid gap-1.5">
                <Label>{`{{${i + 1}}}`}</Label>
                <Input
                  value={val}
                  onChange={(e) => {
                    const next = [...params];
                    next[i] = e.target.value;
                    setParams(next);
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {!existingFollowUp && (
          <DialogFooter>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={saving || !selectedTemplate || !delayDays || params.some((p) => !p.trim())}
            >
              {saving ? <Loader2 className="animate-spin" /> : <Plus />}
              Schedule follow-up
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
