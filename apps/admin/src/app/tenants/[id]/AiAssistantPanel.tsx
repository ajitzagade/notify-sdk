'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, XCircle, Sparkles, Save, Loader2 } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { CardTitleGroup } from '@/components/card-title-group';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/lib/toast';
import type { AiConfigStatus } from '@/lib/aiConfig';
import type { AiProvider } from '@/lib/ai/generate';

const MODEL_PLACEHOLDER: Record<AiProvider, string> = {
  openai:    'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-20241022',
};

export function AiAssistantPanel({ tenantId, status }: { tenantId: string; status: AiConfigStatus }) {
  const router = useRouter();

  const [provider, setProvider]         = useState<AiProvider>(status.provider ?? 'openai');
  const [model, setModel]               = useState(status.model ?? '');
  const [apiKey, setApiKey]             = useState('');
  const [systemPrompt, setSystemPrompt] = useState(status.systemPrompt ?? '');
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(status.autoReplyEnabled);
  const [maxReplies, setMaxReplies]     = useState(String(status.autoReplyMaxPerConversation));

  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const handleTest = async () => {
    if (!apiKey || !model) {
      setTestResult({ ok: false, text: 'Enter a model and an API key first.' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/ai/test`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ provider, apiKey, model }),
      });
      const data = await res.json();
      setTestResult(
        data.ok ? { ok: true, text: `Connected — ${provider} responded to a real test call.` } : { ok: false, text: data.error ?? 'Test failed' }
      );
    } catch (err) {
      setTestResult({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/ai`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          model,
          apiKey: apiKey || undefined,
          systemPrompt,
          autoReplyEnabled,
          autoReplyMaxPerConversation: Number(maxReplies) || 3,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save');
      toast.success('AI assistant settings saved');
      setApiKey('');
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
        <CardTitleGroup
          icon={Sparkles}
          title="AI reply assistant"
          titleExtra={
            <Badge variant={status.configured ? 'default' : 'outline'}>
              {status.configured ? 'Configured' : 'Not configured'}
            </Badge>
          }
          description="Answers inbound messages automatically with your own OpenAI or Anthropic key, then hands off to a human when it can't help."
        />
      </CardHeader>
      <CardContent>
        <form id="ai-assistant-form" onSubmit={handleSave} className="grid max-w-2xl gap-5">
          <fieldset className="grid gap-4">
            <legend className="mb-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Connection</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Provider</Label>
                <Select
                  value={provider}
                  onValueChange={(v) => v && setProvider(v as AiProvider)}
                  items={{ openai: 'OpenAI', anthropic: 'Anthropic' }}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ai-model">Model</Label>
                <Input id="ai-model" placeholder={MODEL_PLACEHOLDER[provider]} value={model} onChange={(e) => setModel(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ai-key">
                API key {status.configured && <span className="font-normal text-muted-foreground">(leave blank to keep current)</span>}
              </Label>
              <Input id="ai-key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
              <p className="text-xs text-muted-foreground">Encrypted at rest — only ever sent to {provider === 'openai' ? 'OpenAI' : 'Anthropic'}.</p>
            </div>
          </fieldset>

          <fieldset className="grid gap-4 border-t border-border/60 pt-4">
            <legend className="sr-only">Behaviour</legend>
            <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Behaviour</div>
            <div className="grid gap-2">
              <Label htmlFor="ai-prompt">System prompt / business context</Label>
              <Textarea
                id="ai-prompt"
                rows={4}
                placeholder="You are the support assistant for Acme Corp. Be concise and friendly. Hand off billing questions to a human."
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={autoReplyEnabled} onCheckedChange={(c) => setAutoReplyEnabled(c === true)} />
                Auto-reply to inbound messages
              </label>
              <div className="flex items-center gap-2">
                <Label htmlFor="ai-max-replies" className="text-sm font-normal">Cap per conversation</Label>
                <Input
                  id="ai-max-replies"
                  type="number"
                  min={0}
                  max={20}
                  className="w-20"
                  value={maxReplies}
                  onChange={(e) => setMaxReplies(e.target.value)}
                />
              </div>
            </div>
          </fieldset>

          {testResult && (
            <Alert variant={testResult.ok ? 'success' : 'destructive'}>
              {testResult.ok ? <CheckCircle2 /> : <XCircle />}
              <AlertDescription>{testResult.text}</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>
      <CardFooter className="gap-2">
        <Button type="button" variant="outline" onClick={handleTest} disabled={testing}>
          <Sparkles /> {testing ? 'Testing…' : 'Test key'}
        </Button>
        <Button type="submit" form="ai-assistant-form" disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />}
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </CardFooter>
    </Card>
  );
}
