import { getPool } from './db';

export interface ContactRecord {
  id: string;
  tenantId: string;
  phone: string;
  name: string | null;
  attributes: Record<string, unknown>;
  createdAt: string;
}

function rowToContact(row: Record<string, unknown>): ContactRecord {
  return {
    id:          row.id as string,
    tenantId:    row.tenant_id as string,
    phone:       row.phone as string,
    name:        row.name as string | null,
    attributes:  row.attributes as Record<string, unknown>,
    createdAt:   row.created_at as string,
  };
}

export async function listContacts(tenantId: string): Promise<ContactRecord[]> {
  const { rows } = await getPool().query(
    `SELECT * FROM contacts WHERE tenant_id = $1 ORDER BY created_at DESC`,
    [tenantId]
  );
  return rows.map(rowToContact);
}

/** Upserts by (tenant_id, phone) — re-importing the same phone updates the name. */
export async function upsertContact(tenantId: string, phone: string, name?: string): Promise<ContactRecord> {
  const { rows } = await getPool().query(
    `INSERT INTO contacts (tenant_id, phone, name)
     VALUES ($1, $2, $3)
     ON CONFLICT (tenant_id, phone) DO UPDATE SET
       name = COALESCE(EXCLUDED.name, contacts.name), updated_at = NOW()
     RETURNING *`,
    [tenantId, phone, name ?? null]
  );
  return rowToContact(rows[0]);
}

export interface CsvImportRow {
  phone: string;
  name?: string;
}

/** Parses `phone,name` per line (name optional). No CSV dependency — inputs are simple two-column data. */
export function parseContactsCsv(raw: string): CsvImportRow[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [phoneRaw, ...rest] = line.split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
      return { phone: phoneRaw.replace(/[^0-9]/g, ''), name: rest.join(',') || undefined };
    })
    .filter((row) => row.phone.length > 0);
}
