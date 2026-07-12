import { getPool } from './db';

export interface TenantRecord {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended' | 'archived';
  logoBlobUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  businessDescription: string | null;
  createdAt: string;
  updatedAt: string;
}

function rowToTenant(row: Record<string, unknown>): TenantRecord {
  return {
    id:                   row.id as string,
    name:                 row.name as string,
    slug:                 row.slug as string,
    status:               row.status as TenantRecord['status'],
    logoBlobUrl:          row.logo_blob_url as string | null,
    primaryColor:         row.primary_color as string | null,
    secondaryColor:       row.secondary_color as string | null,
    businessDescription:  row.business_description as string | null,
    createdAt:            row.created_at as string,
    updatedAt:            row.updated_at as string,
  };
}

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug) && slug.length >= 2 && slug.length <= 100;
}

export async function listTenants(): Promise<TenantRecord[]> {
  const { rows } = await getPool().query(
    `SELECT * FROM tenants ORDER BY created_at DESC`
  );
  return rows.map(rowToTenant);
}

export async function getTenant(id: string): Promise<TenantRecord | null> {
  const { rows } = await getPool().query(`SELECT * FROM tenants WHERE id = $1 LIMIT 1`, [id]);
  return rows[0] ? rowToTenant(rows[0]) : null;
}

export async function createTenant(input: {
  name: string;
  slug: string;
  businessDescription?: string;
}): Promise<TenantRecord> {
  const { rows } = await getPool().query(
    `INSERT INTO tenants (name, slug, business_description) VALUES ($1, $2, $3) RETURNING *`,
    [input.name, input.slug, input.businessDescription ?? null]
  );
  return rowToTenant(rows[0]);
}

export async function updateTenantBranding(
  id: string,
  update: { name?: string; primaryColor?: string; secondaryColor?: string; businessDescription?: string }
): Promise<TenantRecord | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (update.name !== undefined)                 { fields.push(`name = $${i++}`); values.push(update.name); }
  if (update.primaryColor !== undefined)          { fields.push(`primary_color = $${i++}`); values.push(update.primaryColor); }
  if (update.secondaryColor !== undefined)        { fields.push(`secondary_color = $${i++}`); values.push(update.secondaryColor); }
  if (update.businessDescription !== undefined)   { fields.push(`business_description = $${i++}`); values.push(update.businessDescription); }

  if (!fields.length) return getTenant(id);
  fields.push(`updated_at = NOW()`);
  values.push(id);

  const { rows } = await getPool().query(
    `UPDATE tenants SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  return rows[0] ? rowToTenant(rows[0]) : null;
}

export async function setTenantLogoUrl(id: string, logoBlobUrl: string): Promise<void> {
  await getPool().query(`UPDATE tenants SET logo_blob_url = $1, updated_at = NOW() WHERE id = $2`, [logoBlobUrl, id]);
}

export interface CredentialsStatus {
  configured: boolean;
  phoneNumberId?: string;
  wabaId?: string | null;
  lastVerifiedAt?: string | null;
  lastVerifiedStatus?: string | null;
}

export async function getCredentialStatus(tenantId: string): Promise<CredentialsStatus> {
  const { rows } = await getPool().query(
    `SELECT phone_number_id, waba_id, last_verified_at, last_verified_status
       FROM tenant_wa_credentials WHERE tenant_id = $1 LIMIT 1`,
    [tenantId]
  );
  if (!rows[0]) return { configured: false };
  return {
    configured:          true,
    phoneNumberId:       rows[0].phone_number_id as string,
    wabaId:              rows[0].waba_id as string | null,
    lastVerifiedAt:      rows[0].last_verified_at as string | null,
    lastVerifiedStatus:  rows[0].last_verified_status as string | null,
  };
}
