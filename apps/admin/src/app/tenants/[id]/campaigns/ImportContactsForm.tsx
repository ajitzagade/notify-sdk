'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { BroadcastListRecord } from '@/lib/broadcastLists';

export function ImportContactsForm({ tenantId, lists }: { tenantId: string; lists: BroadcastListRecord[] }) {
  const router = useRouter();
  const [csv, setCsv]                     = useState('');
  const [listName, setListName]           = useState('');
  const [alreadyOptedIn, setAlreadyOptedIn] = useState(false);
  const [importing, setImporting]         = useState(false);
  const [result, setResult]               = useState<{ ok: boolean; text: string } | null>(null);

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setImporting(true);
    setResult(null);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/contacts/import`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ csv, listName, alreadyOptedIn }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Import failed');
      setResult({ ok: true, text: `Imported ${data.imported} contact(s) into "${data.list.name}"${data.optedIn ? ' (marked opted-in)' : ''}.` });
      setCsv('');
      router.refresh();
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setImporting(false);
    }
  };

  return (
    <section style={{ padding: 20, border: '1px solid #eee', borderRadius: 8, marginBottom: 20 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Import contacts</h2>
      <p style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
        One contact per line: <code>phone,name</code> (name optional). Adds them all to a broadcast list.
      </p>

      <form onSubmit={handleImport}>
        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: '#444', display: 'block', marginBottom: 4 }}>Contacts CSV</span>
          <textarea
            required
            rows={6}
            placeholder={'919876543210,Priya Sharma\n919123456789,Rahul Verma'}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', fontSize: 13, fontFamily: 'monospace', border: '1px solid #ddd', borderRadius: 6 }}
          />
        </label>

        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: '#444', display: 'block', marginBottom: 4 }}>Broadcast list name (existing or new)</span>
          <input
            required
            list="existing-lists"
            value={listName}
            onChange={(e) => setListName(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', fontSize: 14, border: '1px solid #ddd', borderRadius: 6 }}
          />
          <datalist id="existing-lists">
            {lists.map((l) => <option key={l.id} value={l.name} />)}
          </datalist>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 13 }}>
          <input type="checkbox" checked={alreadyOptedIn} onChange={(e) => setAlreadyOptedIn(e.target.checked)} />
          These contacts already consented to WhatsApp messages elsewhere (marks them opted-in — no message is sent)
        </label>

        <button
          type="submit"
          disabled={importing}
          style={{ padding: '8px 16px', fontSize: 14, border: 'none', borderRadius: 6, cursor: 'pointer', background: '#111', color: '#fff' }}
        >
          {importing ? 'Importing…' : 'Import'}
        </button>

        {result && (
          <div style={{ marginTop: 12, fontSize: 13, color: result.ok ? '#0a7' : '#c00' }}>{result.text}</div>
        )}
      </form>

      {lists.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <span style={{ fontSize: 12, color: '#444', display: 'block', marginBottom: 8 }}>Existing lists</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {lists.map((l) => (
              <span key={l.id} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6, border: '1px solid #eee', color: '#555' }}>
                {l.name} · {l.memberCount} member{l.memberCount === 1 ? '' : 's'}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
