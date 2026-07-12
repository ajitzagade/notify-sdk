'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TemplateRecord } from '@/lib/templates';

const STATUS_COLOR: Record<string, string> = {
  APPROVED: '#0a7',
  PENDING:  '#c80',
  REJECTED: '#c00',
};

export function TemplatesPanel({ tenantId, templates }: { tenantId: string; templates: TemplateRecord[] }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/templates/sync`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Sync failed');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <section style={{ padding: 20, border: '1px solid #eee', borderRadius: 8, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>WhatsApp templates</h2>
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          style={{ padding: '6px 14px', fontSize: 13, border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', background: '#fff' }}
        >
          {syncing ? 'Syncing…' : 'Sync from Meta'}
        </button>
      </div>
      <p style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
        Meta-approved templates — required to message a user outside the 24h session window.
        Syncing requires a WhatsApp Business Account ID on the Credentials panel.
      </p>

      {error && <div style={{ fontSize: 13, color: '#c00', marginBottom: 12 }}>{error}</div>}

      {templates.length === 0 ? (
        <p style={{ fontSize: 13, color: '#999' }}>No templates synced yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {templates.map((t) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid #f0f0f0', borderRadius: 6, fontSize: 13 }}>
              <span style={{ fontWeight: 500 }}>{t.name}</span>
              <span style={{ color: '#999' }}>{t.language}</span>
              <span style={{ color: '#999' }}>{t.category}</span>
              <span style={{ marginLeft: 'auto', color: STATUS_COLOR[t.status] ?? '#999', fontSize: 12 }}>{t.status}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
