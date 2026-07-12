import Link from 'next/link';
import { requireAdminSessionOrRedirect } from '@/lib/auth';
import { listTenants } from '@/lib/tenants';
import { NewTenantForm } from './NewTenantForm';

export default async function TenantsPage() {
  requireAdminSessionOrRedirect();
  const tenants = await listTenants();

  return (
    <main style={{ maxWidth: 800, margin: '48px auto', padding: '0 20px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 24 }}>Tenants</h1>

      <NewTenantForm />

      <div style={{ marginTop: 32 }}>
        {tenants.length === 0 && <p style={{ color: '#666', fontSize: 14 }}>No tenants yet.</p>}
        {tenants.map((t) => (
          <Link
            key={t.id}
            href={`/tenants/${t.id}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: 14,
              border: '1px solid #eee', borderRadius: 8, marginBottom: 8,
              textDecoration: 'none', color: '#111',
            }}
          >
            {t.logoBlobUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.logoBlobUrl} alt="" width={32} height={32} style={{ borderRadius: 6, objectFit: 'cover' }} />
            ) : (
              <div style={{ width: 32, height: 32, borderRadius: 6, background: t.primaryColor ?? '#ddd' }} />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{t.name}</div>
              <div style={{ fontSize: 12, color: '#888' }}>{t.slug}</div>
            </div>
            <span style={{ fontSize: 12, color: t.status === 'active' ? '#0a7' : '#999' }}>{t.status}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
