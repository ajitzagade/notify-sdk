'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function NewTenantForm() {
  const router = useRouter();
  const [name, setName]   = useState('');
  const [slug, setSlug]   = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/tenants', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, slug: slug || slugify(name) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create tenant');
      router.push(`/tenants/${data.tenant.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', gap: 8, alignItems: 'flex-end', padding: 16, border: '1px solid #eee', borderRadius: 8 }}
    >
      <label style={{ flex: 1 }}>
        <span style={{ fontSize: 12, color: '#444', display: 'block', marginBottom: 4 }}>Business name</span>
        <input
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
          style={{ width: '100%', padding: '8px 10px', fontSize: 14, border: '1px solid #ddd', borderRadius: 6 }}
        />
      </label>
      <label style={{ flex: 1 }}>
        <span style={{ fontSize: 12, color: '#444', display: 'block', marginBottom: 4 }}>Slug</span>
        <input
          required
          value={slug}
          onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
          style={{ width: '100%', padding: '8px 10px', fontSize: 14, border: '1px solid #ddd', borderRadius: 6 }}
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        style={{ padding: '8px 16px', fontSize: 14, border: 'none', borderRadius: 6, cursor: 'pointer', background: '#111', color: '#fff' }}
      >
        {loading ? 'Creating…' : 'New tenant'}
      </button>
      {error && <div style={{ fontSize: 12, color: '#c00' }}>{error}</div>}
    </form>
  );
}
