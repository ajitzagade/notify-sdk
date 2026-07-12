'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ApiKeyRecord } from '@/lib/apiKeys';

export function ApiKeysPanel({ tenantId, apiKeys }: { tenantId: string; apiKeys: ApiKeyRecord[] }) {
  const router = useRouter();
  const [label, setLabel]         = useState('');
  const [creating, setCreating]   = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [newKey, setNewKey]       = useState<string | null>(null);
  const [copied, setCopied]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setNewKey(null);
    setCopied(false);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/api-keys`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ label: label || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create key');
      setNewKey(data.fullKey);
      setLabel('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    setRevokingId(keyId);
    setError(null);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/api-keys/${keyId}/revoke`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to revoke key');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRevokingId(null);
    }
  };

  const copyKey = async () => {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    setCopied(true);
  };

  return (
    <section style={{ padding: 20, border: '1px solid #eee', borderRadius: 8, marginBottom: 20 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>API keys</h2>
      <p style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
        For this tenant&apos;s own backend to send messages programmatically via <code>POST /v1/send</code>.
      </p>

      <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          placeholder="Label (optional, e.g. production backend)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          style={{ flex: 1, padding: '8px 10px', fontSize: 14, border: '1px solid #ddd', borderRadius: 6 }}
        />
        <button
          type="submit"
          disabled={creating}
          style={{ padding: '8px 16px', fontSize: 14, border: 'none', borderRadius: 6, cursor: 'pointer', background: '#111', color: '#fff' }}
        >
          {creating ? 'Creating…' : 'New key'}
        </button>
      </form>

      {newKey && (
        <div style={{ marginBottom: 16, padding: 12, background: '#fffbe6', border: '1px solid #f0d060', borderRadius: 6 }}>
          <div style={{ fontSize: 12, color: '#7a5c00', marginBottom: 6 }}>
            Copy this now — it won&apos;t be shown again.
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code style={{ flex: 1, fontSize: 13, wordBreak: 'break-all', background: '#fff', padding: '6px 8px', borderRadius: 4 }}>{newKey}</code>
            <button
              type="button"
              onClick={copyKey}
              style={{ padding: '6px 12px', fontSize: 12, border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', background: '#fff' }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {error && <div style={{ fontSize: 13, color: '#c00', marginBottom: 12 }}>{error}</div>}

      {apiKeys.length === 0 ? (
        <p style={{ fontSize: 13, color: '#999' }}>No API keys yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {apiKeys.map((k) => (
            <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid #f0f0f0', borderRadius: 6, fontSize: 13 }}>
              <code>nsk_{k.keyPrefix}…</code>
              <span style={{ color: '#999' }}>{k.label ?? 'unlabeled'}</span>
              <span style={{ color: '#999', fontSize: 12 }}>
                {k.lastUsedAt ? `last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : 'never used'}
              </span>
              <span style={{ marginLeft: 'auto' }}>
                {k.revokedAt ? (
                  <span style={{ color: '#c00', fontSize: 12 }}>revoked</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleRevoke(k.id)}
                    disabled={revokingId === k.id}
                    style={{ padding: '4px 10px', fontSize: 12, border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', background: '#fff' }}
                  >
                    {revokingId === k.id ? 'Revoking…' : 'Revoke'}
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
