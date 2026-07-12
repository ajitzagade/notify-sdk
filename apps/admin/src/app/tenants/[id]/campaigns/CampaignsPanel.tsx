'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { BroadcastListRecord } from '@/lib/broadcastLists';
import type { TemplateRecord } from '@/lib/templates';
import type { CampaignRecord } from '@/lib/campaigns';

function bodyText(template: TemplateRecord): string {
  return template.components.find((c) => c.type === 'BODY')?.text ?? '';
}

function placeholderCount(text: string): number {
  const matches = [...text.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  return matches.length ? Math.max(...matches) : 0;
}

const STATUS_COLOR: Record<string, string> = {
  draft:     '#999',
  running:   '#c80',
  completed: '#0a7',
  failed:    '#c00',
};

export function CampaignsPanel({
  tenantId,
  lists,
  templates,
  campaigns,
}: {
  tenantId: string;
  lists: BroadcastListRecord[];
  templates: TemplateRecord[];
  campaigns: CampaignRecord[];
}) {
  const router = useRouter();
  const [name, setName]             = useState('');
  const [listId, setListId]         = useState('');
  const [templateId, setTemplateId] = useState('');
  const [params, setParams]         = useState<string[]>([]);
  const [creating, setCreating]     = useState(false);
  const [runningId, setRunningId]   = useState<string | null>(null);
  const [error, setError]           = useState<string | null>(null);

  const selectedTemplate = templates.find((t) => t.id === templateId) ?? null;
  const paramCount       = useMemo(() => (selectedTemplate ? placeholderCount(bodyText(selectedTemplate)) : 0), [selectedTemplate]);

  const selectTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    setParams(t ? new Array(placeholderCount(bodyText(t))).fill('') : []);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/campaigns`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          broadcastListId: listId,
          hsmTemplateName: selectedTemplate.name,
          hsmLanguage:     selectedTemplate.language,
          hsmParams:       params,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create campaign');
      setName('');
      setListId('');
      setTemplateId('');
      setParams([]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  const handleRun = async (campaignId: string) => {
    setRunningId(campaignId);
    setError(null);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/campaigns/${campaignId}/run`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Run failed');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunningId(null);
    }
  };

  return (
    <section style={{ padding: 20, border: '1px solid #eee', borderRadius: 8, marginBottom: 20 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Campaigns</h2>
      <p style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
        Broadcast a Meta-approved template to an entire list. Only members who&apos;ve opted in will actually receive it —
        everyone else is counted as skipped.
      </p>

      {lists.length === 0 || templates.length === 0 ? (
        <p style={{ fontSize: 13, color: '#999', marginBottom: 16 }}>
          {lists.length === 0 && 'Import contacts into a list first. '}
          {templates.length === 0 && 'Sync WhatsApp templates first (see the Templates panel above).'}
        </p>
      ) : (
        <form onSubmit={handleCreate} style={{ marginBottom: 20, padding: 12, background: '#fafafa', borderRadius: 6 }}>
          <label style={{ display: 'block', marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: '#444', display: 'block', marginBottom: 4 }}>Campaign name</span>
            <input required value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%', padding: '8px 10px', fontSize: 14, border: '1px solid #ddd', borderRadius: 6 }} />
          </label>

          <label style={{ display: 'block', marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: '#444', display: 'block', marginBottom: 4 }}>Broadcast list</span>
            <select required value={listId} onChange={(e) => setListId(e.target.value)} style={{ width: '100%', padding: '8px 10px', fontSize: 14, border: '1px solid #ddd', borderRadius: 6 }}>
              <option value="" disabled>Choose a list…</option>
              {lists.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.memberCount} members)</option>)}
            </select>
          </label>

          <label style={{ display: 'block', marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: '#444', display: 'block', marginBottom: 4 }}>Template</span>
            <select required value={templateId} onChange={(e) => selectTemplate(e.target.value)} style={{ width: '100%', padding: '8px 10px', fontSize: 14, border: '1px solid #ddd', borderRadius: 6 }}>
              <option value="" disabled>Choose a template…</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.language}) — {t.status}</option>)}
            </select>
          </label>

          {params.map((val, i) => (
            <label key={i} style={{ display: 'block', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#444', display: 'block', marginBottom: 4 }}>{`{{${i + 1}}}`}</span>
              <input
                required
                value={val}
                onChange={(e) => {
                  const next = [...params];
                  next[i] = e.target.value;
                  setParams(next);
                }}
                style={{ width: '100%', padding: '8px 10px', fontSize: 14, border: '1px solid #ddd', borderRadius: 6 }}
              />
            </label>
          ))}

          <button
            type="submit"
            disabled={creating || !listId || !templateId || params.some((p) => !p.trim())}
            style={{ padding: '8px 16px', fontSize: 14, border: 'none', borderRadius: 6, cursor: 'pointer', background: '#111', color: '#fff' }}
          >
            {creating ? 'Creating…' : 'Create campaign'}
          </button>
        </form>
      )}

      {error && <div style={{ fontSize: 13, color: '#c00', marginBottom: 12 }}>{error}</div>}

      {campaigns.length === 0 ? (
        <p style={{ fontSize: 13, color: '#999' }}>No campaigns yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {campaigns.map((c) => (
            <div key={c.id} style={{ padding: 12, border: '1px solid #f0f0f0', borderRadius: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, marginBottom: 4 }}>
                <span style={{ fontWeight: 500 }}>{c.name}</span>
                <span style={{ color: '#999' }}>{c.hsmTemplateName}</span>
                <span style={{ marginLeft: 'auto', color: STATUS_COLOR[c.status], fontSize: 12 }}>{c.status}</span>
                {c.status === 'draft' && (
                  <button
                    type="button"
                    onClick={() => handleRun(c.id)}
                    disabled={runningId === c.id}
                    style={{ padding: '4px 10px', fontSize: 12, border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', background: '#fff' }}
                  >
                    {runningId === c.id ? 'Running…' : 'Run'}
                  </button>
                )}
              </div>
              {c.stats && (
                <div style={{ fontSize: 12, color: '#666' }}>
                  {'error' in c.stats
                    ? `Error: ${c.stats.error}`
                    : `Sent: ${c.stats.sent}, Failed: ${c.stats.failed}, Skipped: ${c.stats.skipped}, Total: ${c.stats.total}`}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
