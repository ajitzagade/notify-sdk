'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TenantRecord } from '@/lib/tenants';

export function BrandingForm({ tenant }: { tenant: TenantRecord }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName]                 = useState(tenant.name);
  const [primaryColor, setPrimaryColor] = useState(tenant.primaryColor ?? '#111111');
  const [description, setDescription]   = useState(tenant.businessDescription ?? '');
  const [saving, setSaving]             = useState(false);
  const [uploading, setUploading]       = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [savedAt, setSavedAt]           = useState<number | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenants/${tenant.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, primaryColor, businessDescription: description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save');
      setSavedAt(Date.now());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/tenants/${tenant.id}/logo`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <section style={{ padding: 20, border: '1px solid #eee', borderRadius: 8, marginBottom: 20 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Branding</h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        {tenant.logoBlobUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tenant.logoBlobUrl} alt="" width={56} height={56} style={{ borderRadius: 8, objectFit: 'cover', border: '1px solid #eee' }} />
        ) : (
          <div style={{ width: 56, height: 56, borderRadius: 8, background: primaryColor }} />
        )}
        <div>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogoChange} disabled={uploading} />
          {uploading && <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>Uploading…</div>}
        </div>
      </div>

      <form onSubmit={handleSave}>
        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: '#444', display: 'block', marginBottom: 4 }}>Business name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%', padding: '8px 10px', fontSize: 14, border: '1px solid #ddd', borderRadius: 6 }} />
        </label>
        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: '#444', display: 'block', marginBottom: 4 }}>Primary color</span>
          <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} style={{ width: 60, height: 32, padding: 0, border: '1px solid #ddd', borderRadius: 6 }} />
        </label>
        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ fontSize: 12, color: '#444', display: 'block', marginBottom: 4 }}>Business description</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ width: '100%', padding: '8px 10px', fontSize: 14, border: '1px solid #ddd', borderRadius: 6, fontFamily: 'inherit' }} />
        </label>

        {error && <div style={{ fontSize: 13, color: '#c00', marginBottom: 12 }}>{error}</div>}

        <button type="submit" disabled={saving} style={{ padding: '8px 16px', fontSize: 14, border: 'none', borderRadius: 6, cursor: 'pointer', background: '#111', color: '#fff' }}>
          {saving ? 'Saving…' : 'Save branding'}
        </button>
        {savedAt && <span style={{ marginLeft: 12, fontSize: 12, color: '#0a7' }}>Saved</span>}
      </form>
    </section>
  );
}
