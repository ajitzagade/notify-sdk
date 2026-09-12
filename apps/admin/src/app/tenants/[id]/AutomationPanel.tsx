'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Workflow, Plus, Pencil, Trash2, Loader2, X, AlertCircle } from 'lucide-react';
import type { FlowDefinitionRecord, FlowStep } from '@/lib/flowDefinitions';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { CardTitleGroup } from '@/components/card-title-group';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/lib/toast';

type DraftStep = { question: string; optionsText: string };

function emptyDraftStep(): DraftStep {
  return { question: '', optionsText: '' };
}

function stepsToDraft(steps: FlowStep[]): DraftStep[] {
  return steps.map((s) => ({ question: s.question, optionsText: (s.options ?? []).join(', ') }));
}

function draftToSteps(draft: DraftStep[]): FlowStep[] {
  return draft
    .filter((s) => s.question.trim())
    .map((s) => {
      const options = s.optionsText.split(',').map((o) => o.trim()).filter(Boolean).slice(0, 3);
      return options.length ? { question: s.question.trim(), options } : { question: s.question.trim() };
    });
}

export function AutomationPanel({
  tenantId, flows, baseApiPath,
}: { tenantId: string; flows: FlowDefinitionRecord[]; baseApiPath?: string }) {
  const apiBase = baseApiPath ?? `/api/tenants/${tenantId}`;
  const router = useRouter();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [triggerKeyword, setTriggerKeyword] = useState('');
  const [steps, setSteps] = useState<DraftStep[]>([emptyDraftStep()]);
  const [completionMessage, setCompletionMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startNew = () => {
    setEditingId(null);
    setTriggerKeyword('');
    setSteps([emptyDraftStep()]);
    setCompletionMessage('');
    setError(null);
  };

  const startEdit = (flow: FlowDefinitionRecord) => {
    setEditingId(flow.id);
    setTriggerKeyword(flow.triggerKeyword);
    setSteps(stepsToDraft(flow.steps));
    setCompletionMessage(flow.completionMessage);
    setError(null);
  };

  const handleSave = async () => {
    setError(null);
    const finalSteps = draftToSteps(steps);
    if (!triggerKeyword.trim() || !finalSteps.length || !completionMessage.trim()) {
      setError('Trigger keyword, at least one question, and a completion message are all required.');
      return;
    }
    setSaving(true);
    try {
      const url = editingId ? `${apiBase}/flows/${editingId}` : `${apiBase}/flows`;
      const res = await fetch(url, {
        method:  editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ triggerKeyword: triggerKeyword.trim(), steps: finalSteps, completionMessage: completionMessage.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      toast.success(editingId ? 'Flow updated' : 'Flow created');
      startNew();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (flow: FlowDefinitionRecord) => {
    try {
      const res = await fetch(`${apiBase}/flows/${flow.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ isActive: !flow.isActive }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Update failed');
      toast.success(flow.isActive ? 'Flow paused' : 'Flow activated');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async (flow: FlowDefinitionRecord) => {
    try {
      const res = await fetch(`${apiBase}/flows/${flow.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Delete failed');
      if (editingId === flow.id) startNew();
      toast.success('Flow deleted');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitleGroup
            icon={Workflow}
            title="Automation flows"
            description="A customer texts a keyword to start a guided Q&A — WhatsApp buttons or free text, one question at a time."
          />
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="grid gap-3">
            {flows.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="flex size-11 items-center justify-center rounded-full bg-muted">
                  <Workflow className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">No flows yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">Build one on the right — it goes live the moment you save it.</p>
                </div>
              </div>
            ) : (
              flows.map((flow) => (
                <div key={flow.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-semibold">&quot;{flow.triggerKeyword}&quot;</code>
                        <Badge variant={flow.isActive ? 'default' : 'outline'}>{flow.isActive ? 'Active' : 'Paused'}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{flow.steps.length} question{flow.steps.length === 1 ? '' : 's'}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleToggleActive(flow)}>
                        {flow.isActive ? 'Pause' : 'Activate'}
                      </Button>
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => startEdit(flow)}><Pencil /></Button>
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => handleDelete(flow)}><Trash2 /></Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="grid gap-3 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{editingId ? 'Edit flow' : 'New flow'}</p>
              {editingId && <Button type="button" variant="ghost" size="sm" onClick={startNew}><X /> Cancel</Button>}
            </div>

            {error && (
              <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>
            )}

            <div className="grid gap-1.5">
              <Label>Trigger keyword</Label>
              <Input placeholder="e.g. book" value={triggerKeyword} onChange={(e) => setTriggerKeyword(e.target.value)} />
              <p className="text-xs text-muted-foreground">What a customer texts to start this flow. Can&apos;t be stop/start/subscribe/unsubscribe.</p>
            </div>

            <div className="grid gap-2">
              <Label>Questions, in order</Label>
              {steps.map((step, i) => (
                <div key={i} className="grid gap-1.5 rounded-md bg-muted/40 p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Q{i + 1}</span>
                    {steps.length > 1 && (
                      <Button type="button" variant="ghost" size="icon-xs" className="ml-auto" onClick={() => setSteps((s) => s.filter((_, j) => j !== i))}>
                        <X />
                      </Button>
                    )}
                  </div>
                  <Input
                    placeholder="Question text"
                    value={step.question}
                    onChange={(e) => setSteps((s) => s.map((st, j) => (j === i ? { ...st, question: e.target.value } : st)))}
                  />
                  <Input
                    placeholder="Button options, comma-separated (optional — up to 3, leave blank for free text)"
                    value={step.optionsText}
                    onChange={(e) => setSteps((s) => s.map((st, j) => (j === i ? { ...st, optionsText: e.target.value } : st)))}
                  />
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setSteps((s) => [...s, emptyDraftStep()])}>
                <Plus /> Add question
              </Button>
            </div>

            <div className="grid gap-1.5">
              <Label>Completion message</Label>
              <Textarea placeholder="Sent after the last question is answered" rows={2} value={completionMessage} onChange={(e) => setCompletionMessage(e.target.value)} />
            </div>

            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Plus />}
              {editingId ? 'Save changes' : 'Create flow'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
