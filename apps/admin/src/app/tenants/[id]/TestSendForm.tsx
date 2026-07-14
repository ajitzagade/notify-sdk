'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, Send, Loader2 } from 'lucide-react';
import type { MediaAssetRecord } from '@/lib/media';
import type { TemplateRecord } from '@/lib/templates';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CardTitleGroup } from '@/components/card-title-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WhatsAppPreview } from '@/components/whatsapp-preview';
import { toast } from '@/lib/toast';

type SendMode = 'text' | 'media' | 'template';

function bodyText(template: TemplateRecord): string {
  return template.components.find((c) => c.type === 'BODY')?.text ?? '';
}

function placeholderCount(text: string): number {
  const matches = [...text.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  return matches.length ? Math.max(...matches) : 0;
}

function PickerPill({ selected, onClick, children, title }: { selected: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <Button type="button" variant={selected ? 'default' : 'outline'} size="sm" onClick={onClick} title={title}>
      {children}
    </Button>
  );
}

export function TestSendForm({
  tenantId,
  tenantName,
  credentialsConfigured,
  mediaAssets,
  templates,
}: {
  tenantId: string;
  tenantName: string;
  credentialsConfigured: boolean;
  mediaAssets: MediaAssetRecord[];
  templates: TemplateRecord[];
}) {
  const router = useRouter();
  const [fileInputKey, setFileInputKey] = useState(0);

  const [mode, setMode]       = useState<SendMode>('text');
  const [phone, setPhone]     = useState('');
  const [message, setMessage] = useState('');

  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [caption, setCaption] = useState('');

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateParams, setTemplateParams] = useState<string[]>([]);

  const [uploading, setUploading] = useState(false);
  const [sending, setSending]     = useState(false);
  const [result, setResult]       = useState<{ ok: boolean; text: string } | null>(null);

  const selectedAsset    = mediaAssets.find((a) => a.id === selectedAssetId) ?? null;
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;
  const templateBody     = selectedTemplate ? bodyText(selectedTemplate) : '';
  const paramCount       = selectedTemplate ? placeholderCount(templateBody) : 0;

  const preview = useMemo(() => {
    if (!templateBody) return '';
    return templateBody.replace(/\{\{(\d+)\}\}/g, (_, n) => templateParams[Number(n) - 1] || `{{${n}}}`);
  }, [templateBody, templateParams]);

  const selectTemplate = (id: string) => {
    setSelectedTemplateId(id);
    const t = templates.find((x) => x.id === id);
    setTemplateParams(t ? new Array(placeholderCount(bodyText(t))).fill('') : []);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/tenants/${tenantId}/media`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      setSelectedAssetId(data.asset.id);
      router.refresh();
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setUploading(false);
      setFileInputKey((k) => k + 1);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setResult(null);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/test-send`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          message: mode === 'text' ? message : undefined,
          attachment: mode === 'media' && selectedAsset
            ? { type: selectedAsset.kind, link: selectedAsset.blobUrl, caption: caption || undefined }
            : undefined,
          hsmTemplate: mode === 'template' && selectedTemplate
            ? {
                name:     selectedTemplate.name,
                language: selectedTemplate.language,
                components: paramCount
                  ? [{ type: 'body', parameters: templateParams.map((v) => ({ type: 'text', text: v })) }]
                  : undefined,
              }
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Send failed');
      if (data.ok) {
        const text = `Sent — status: ${data.event?.status}, WhatsApp message id: ${data.event?.waMessageId ?? 'n/a'}`;
        setResult({ ok: true, text });
        toast.success(text, 'Test message sent');
      } else {
        const text = `Failed — status: ${data.event?.status}, error: ${data.event?.error ?? 'unknown'}`;
        setResult({ ok: false, text });
        toast.error(text);
      }
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      setResult({ ok: false, text });
      toast.error(text);
    } finally {
      setSending(false);
    }
  };

  const handleModeChange = (next: SendMode) => {
    setMode(next);
    setMessage('');
    setCaption('');
    setResult(null);
  };

  const canSend =
    !sending && credentialsConfigured &&
    (mode !== 'template' || (selectedTemplate && templateParams.every((p) => p.trim().length > 0)));

  return (
    <Card>
      <CardHeader>
        <CardTitleGroup
          icon={Send}
          title="Test send"
          description="Send one real message through this tenant's number — proves credentials, sending, and logging end to end."
        />
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <form id="test-send-form" onSubmit={handleSend} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="test-send-phone">Phone number (international, no +)</Label>
            <Input id="test-send-phone" required placeholder="919876543210" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <Tabs value={mode} onValueChange={(v) => handleModeChange(v as SendMode)}>
            <TabsList>
              <TabsTrigger value="text">Text</TabsTrigger>
              <TabsTrigger value="media">Media</TabsTrigger>
              <TabsTrigger value="template">Template</TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="mt-4">
              <div className="grid gap-2">
                <Label htmlFor="test-send-message">Message text</Label>
                <Input id="test-send-message" value={message} onChange={(e) => setMessage(e.target.value)} />
              </div>
            </TabsContent>

            <TabsContent value="media" className="mt-4">
              <div className="grid gap-3 rounded-lg border bg-muted/30 p-3">
                <span className="text-xs font-medium text-muted-foreground">Attach media</span>
                <div className="flex flex-wrap gap-2">
                  {mediaAssets.map((asset) => (
                    <PickerPill
                      key={asset.id}
                      selected={selectedAssetId === asset.id}
                      onClick={() => setSelectedAssetId(asset.id)}
                      title={asset.originalFilename ?? asset.blobUrl}
                    >
                      {asset.kind} · {asset.originalFilename ?? asset.id.slice(0, 8)}
                    </PickerPill>
                  ))}
                </div>
                <Input
                  key={fileInputKey}
                  type="file"
                  accept="image/*,video/*,audio/*,application/pdf"
                  onChange={handleUpload}
                  disabled={uploading}
                />
                {uploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
                {selectedAsset && selectedAsset.kind !== 'audio' && (
                  <div className="grid gap-2">
                    <Label htmlFor="test-send-caption">Caption</Label>
                    <Input id="test-send-caption" value={caption} onChange={(e) => setCaption(e.target.value)} />
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="template" className="mt-4">
              <div className="grid gap-3 rounded-lg border bg-muted/30 p-3">
                <span className="text-xs font-medium text-muted-foreground">Choose a template</span>
                {templates.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No templates synced yet — sync from the panel above.</p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {templates.map((t) => (
                        <PickerPill key={t.id} selected={selectedTemplateId === t.id} onClick={() => selectTemplate(t.id)}>
                          {t.name} ({t.language})
                        </PickerPill>
                      ))}
                    </div>
                    {selectedTemplate && (
                      <>
                        {templateParams.map((val, i) => (
                          <div key={i} className="grid gap-2">
                            <Label htmlFor={`template-param-${i}`}>{`{{${i + 1}}}`}</Label>
                            <Input
                              id={`template-param-${i}`}
                              value={val}
                              onChange={(e) => {
                                const next = [...templateParams];
                                next[i] = e.target.value;
                                setTemplateParams(next);
                              }}
                            />
                          </div>
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {result && (
            <Alert variant={result.ok ? 'success' : 'destructive'}>
              {result.ok ? <CheckCircle2 /> : <XCircle />}
              <AlertDescription>{result.text}</AlertDescription>
            </Alert>
          )}
        </form>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <span className="mb-2 block text-xs font-medium text-muted-foreground">Preview</span>
          <WhatsAppPreview
            senderName={tenantName}
            body={mode === 'text' ? message : mode === 'template' ? preview : undefined}
            mediaUrl={mode === 'media' ? selectedAsset?.blobUrl : undefined}
            mediaKind={mode === 'media' ? selectedAsset?.kind : undefined}
            caption={mode === 'media' ? caption : undefined}
          />
        </div>
        </div>
      </CardContent>
      <CardFooter className="gap-3">
        <Button type="submit" form="test-send-form" disabled={!canSend}>
          {sending ? <Loader2 className="animate-spin" /> : <Send />}
          {sending ? 'Sending…' : 'Send test message'}
        </Button>
        {!credentialsConfigured && (
          <span className="text-xs text-muted-foreground">Configure WhatsApp credentials first</span>
        )}
      </CardFooter>
    </Card>
  );
}
