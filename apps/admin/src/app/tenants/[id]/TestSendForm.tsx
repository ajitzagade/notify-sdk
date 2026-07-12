'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MediaAssetRecord } from '@/lib/media';
import type { TemplateRecord } from '@/lib/templates';

type SendMode = 'text' | 'media' | 'template';

function bodyText(template: TemplateRecord): string {
  return template.components.find((c) => c.type === 'BODY')?.text ?? '';
}

function placeholderCount(text: string): number {
  const matches = [...text.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  return matches.length ? Math.max(...matches) : 0;
}

export function TestSendForm({
  tenantId,
  credentialsConfigured,
  mediaAssets,
  templates,
}: {
  tenantId: string;
  credentialsConfigured: boolean;
  mediaAssets: MediaAssetRecord[];
  templates: TemplateRecord[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      if (fileInputRef.current) fileInputRef.current.value = '';
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
      setResult({
        ok:   data.ok,
        text: data.ok
          ? `Sent — status: ${data.event?.status}, WhatsApp message id: ${data.event?.waMessageId ?? 'n/a'}`
          : `Failed — status: ${data.event?.status}, error: ${data.event?.error ?? 'unknown'}`,
      });
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setSending(false);
    }
  };

  const modeButton = (m: SendMode, label: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      style={{
        padding: '5px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
        border: mode === m ? '1px solid #111' : '1px solid #ddd',
        background: mode === m ? '#111' : '#fff',
        color: mode === m ? '#fff' : '#333',
      }}
    >
      {label}
    </button>
  );

  const canSend =
    !sending && credentialsConfigured &&
    (mode !== 'template' || (selectedTemplate && templateParams.every((p) => p.trim().length > 0)));

  return (
    <section style={{ padding: 20, border: '1px solid #eee', borderRadius: 8, marginBottom: 20 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Test send</h2>
      <p style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
        Opts in a phone number and sends it a real message through this tenant&apos;s WhatsApp number —
        confirms credentials, sending, and logging all work end to end.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {modeButton('text', 'Text')}
        {modeButton('media', 'Media')}
        {modeButton('template', 'Template')}
      </div>

      <form onSubmit={handleSend}>
        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: '#444', display: 'block', marginBottom: 4 }}>Phone number (international, no +)</span>
          <input required placeholder="919876543210" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ width: '100%', padding: '8px 10px', fontSize: 14, border: '1px solid #ddd', borderRadius: 6 }} />
        </label>

        {mode === 'text' && (
          <label style={{ display: 'block', marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: '#444', display: 'block', marginBottom: 4 }}>Message text</span>
            <input value={message} onChange={(e) => setMessage(e.target.value)} style={{ width: '100%', padding: '8px 10px', fontSize: 14, border: '1px solid #ddd', borderRadius: 6 }} />
          </label>
        )}

        {mode === 'media' && (
          <div style={{ marginBottom: 16, padding: 12, background: '#fafafa', borderRadius: 6 }}>
            <span style={{ fontSize: 12, color: '#444', display: 'block', marginBottom: 8 }}>Attach media</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {mediaAssets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => setSelectedAssetId(asset.id)}
                  title={asset.originalFilename ?? asset.blobUrl}
                  style={{
                    padding: '4px 10px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
                    border: selectedAssetId === asset.id ? '1px solid #111' : '1px solid #ddd',
                    background: selectedAssetId === asset.id ? '#111' : '#fff',
                    color: selectedAssetId === asset.id ? '#fff' : '#333',
                  }}
                >
                  {asset.kind} · {asset.originalFilename ?? asset.id.slice(0, 8)}
                </button>
              ))}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*,application/pdf" onChange={handleUpload} disabled={uploading} />
            {uploading && <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>Uploading…</div>}
            {selectedAsset && selectedAsset.kind !== 'audio' && (
              <label style={{ display: 'block', marginTop: 10 }}>
                <span style={{ fontSize: 12, color: '#444', display: 'block', marginBottom: 4 }}>Caption</span>
                <input value={caption} onChange={(e) => setCaption(e.target.value)} style={{ width: '100%', padding: '8px 10px', fontSize: 14, border: '1px solid #ddd', borderRadius: 6 }} />
              </label>
            )}
          </div>
        )}

        {mode === 'template' && (
          <div style={{ marginBottom: 16, padding: 12, background: '#fafafa', borderRadius: 6 }}>
            <span style={{ fontSize: 12, color: '#444', display: 'block', marginBottom: 8 }}>Choose a template</span>
            {templates.length === 0 ? (
              <p style={{ fontSize: 12, color: '#999' }}>No templates synced yet — sync from the panel above.</p>
            ) : (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => selectTemplate(t.id)}
                      style={{
                        padding: '4px 10px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
                        border: selectedTemplateId === t.id ? '1px solid #111' : '1px solid #ddd',
                        background: selectedTemplateId === t.id ? '#111' : '#fff',
                        color: selectedTemplateId === t.id ? '#fff' : '#333',
                      }}
                    >
                      {t.name} ({t.language})
                    </button>
                  ))}
                </div>
                {selectedTemplate && (
                  <>
                    {templateParams.map((val, i) => (
                      <label key={i} style={{ display: 'block', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: '#444', display: 'block', marginBottom: 4 }}>{`{{${i + 1}}}`}</span>
                        <input
                          value={val}
                          onChange={(e) => {
                            const next = [...templateParams];
                            next[i] = e.target.value;
                            setTemplateParams(next);
                          }}
                          style={{ width: '100%', padding: '8px 10px', fontSize: 14, border: '1px solid #ddd', borderRadius: 6 }}
                        />
                      </label>
                    ))}
                    {preview && (
                      <div style={{ marginTop: 8, padding: 8, background: '#fff', border: '1px dashed #ddd', borderRadius: 6, fontSize: 12, color: '#555', whiteSpace: 'pre-wrap' }}>
                        {preview}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSend}
          style={{ padding: '8px 16px', fontSize: 14, border: 'none', borderRadius: 6, cursor: 'pointer', background: '#111', color: '#fff' }}
        >
          {sending ? 'Sending…' : 'Send test message'}
        </button>
        {!credentialsConfigured && (
          <span style={{ marginLeft: 12, fontSize: 12, color: '#999' }}>Configure WhatsApp credentials first</span>
        )}

        {result && (
          <div style={{ marginTop: 12, fontSize: 13, color: result.ok ? '#0a7' : '#c00' }}>{result.text}</div>
        )}
      </form>
    </section>
  );
}
