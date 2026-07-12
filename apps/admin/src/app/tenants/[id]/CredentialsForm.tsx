'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface CredentialsStatus {
  configured: boolean;
  phoneNumberId?: string;
  wabaId?: string | null;
  lastVerifiedAt?: string | null;
  lastVerifiedStatus?: string | null;
}

export function CredentialsForm({ tenantId, status }: { tenantId: string; status: CredentialsStatus }) {
  const router = useRouter();
  const [accessToken, setAccessToken]     = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState(status.phoneNumberId ?? '');
  const [wabaId, setWabaId]               = useState(status.wabaId ?? '');
  const [appSecret, setAppSecret]         = useState('');

  const [verifyResult, setVerifyResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [verifying, setVerifying]       = useState(false);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [savedAt, setSavedAt]           = useState<number | null>(null);

  const handleVerify = async () => {
    setVerifying(true);
    setError(null);
    setVerifyResult(null);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/credentials/verify`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ accessToken, phoneNumberId }),
      });
      const data = await res.json();
      setVerifyResult(
        data.ok
          ? { ok: true, message: `Verified — ${data.displayName ?? 'unnamed'} (${data.displayPhoneNumber ?? phoneNumberId})` }
          : { ok: false, message: data.error ?? 'Verification failed' }
      );
    } catch (err) {
      setVerifyResult({ ok: false, message: err instanceof Error ? err.message : String(err) });
    } finally {
      setVerifying(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/credentials`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ accessToken, phoneNumberId, wabaId: wabaId || undefined, appSecret: appSecret || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save credentials');
      setSavedAt(Date.now());
      setAccessToken('');
      setAppSecret('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section style={{ padding: 20, border: '1px solid #eee', borderRadius: 8, marginBottom: 20 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>WhatsApp credentials</h2>
      <p style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
        {status.configured
          ? `Configured — last verified ${status.lastVerifiedAt ? new Date(status.lastVerifiedAt).toLocaleString() : 'never'} (${status.lastVerifiedStatus ?? 'unknown'})`
          : 'Not configured yet.'}
      </p>

      <form onSubmit={handleSave}>
        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: '#444', display: 'block', marginBottom: 4 }}>Phone Number ID</span>
          <input required value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} style={{ width: '100%', padding: '8px 10px', fontSize: 14, border: '1px solid #ddd', borderRadius: 6 }} />
        </label>
        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: '#444', display: 'block', marginBottom: 4 }}>WhatsApp Business Account ID (optional)</span>
          <input value={wabaId} onChange={(e) => setWabaId(e.target.value)} style={{ width: '100%', padding: '8px 10px', fontSize: 14, border: '1px solid #ddd', borderRadius: 6 }} />
        </label>
        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: '#444', display: 'block', marginBottom: 4 }}>
            Access Token {status.configured && <em style={{ color: '#999' }}>(leave blank to keep current)</em>}
          </span>
          <input required={!status.configured} type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} style={{ width: '100%', padding: '8px 10px', fontSize: 14, border: '1px solid #ddd', borderRadius: 6 }} />
        </label>
        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ fontSize: 12, color: '#444', display: 'block', marginBottom: 4 }}>App Secret (optional, enables webhook signature verification)</span>
          <input type="password" value={appSecret} onChange={(e) => setAppSecret(e.target.value)} style={{ width: '100%', padding: '8px 10px', fontSize: 14, border: '1px solid #ddd', borderRadius: 6 }} />
        </label>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <button
            type="button"
            onClick={handleVerify}
            disabled={verifying || !accessToken || !phoneNumberId}
            style={{ padding: '8px 16px', fontSize: 14, border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', background: '#fff' }}
          >
            {verifying ? 'Verifying…' : 'Verify against Meta'}
          </button>
          <button
            type="submit"
            disabled={saving}
            style={{ padding: '8px 16px', fontSize: 14, border: 'none', borderRadius: 6, cursor: 'pointer', background: '#111', color: '#fff' }}
          >
            {saving ? 'Saving…' : 'Save credentials'}
          </button>
          {savedAt && <span style={{ fontSize: 12, color: '#0a7' }}>Saved</span>}
        </div>

        {verifyResult && (
          <div style={{ fontSize: 13, color: verifyResult.ok ? '#0a7' : '#c00', marginBottom: 8 }}>
            {verifyResult.message}
          </div>
        )}
        {error && <div style={{ fontSize: 13, color: '#c00' }}>{error}</div>}
      </form>
    </section>
  );
}
