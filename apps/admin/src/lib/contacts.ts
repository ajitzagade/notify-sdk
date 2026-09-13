import { getPool } from './db';
import { normalizePhone } from './phone';

export interface ContactRecord {
  id: string;
  tenantId: string;
  phone: string;
  name: string | null;
  tags: string[];
  attributes: Record<string, unknown>;
  createdAt: string;
}

function rowToContact(row: Record<string, unknown>): ContactRecord {
  return {
    id:          row.id as string,
    tenantId:    row.tenant_id as string,
    phone:       row.phone as string,
    name:        row.name as string | null,
    tags:        (row.tags as string[] | null) ?? [],
    attributes:  row.attributes as Record<string, unknown>,
    createdAt:   row.created_at as string,
  };
}

/** `tagFilter` narrows to contacts carrying that exact tag — used by the Contacts page's filter dropdown. */
export async function listContacts(tenantId: string, tagFilter?: string): Promise<ContactRecord[]> {
  const { rows } = await getPool().query(
    `SELECT * FROM contacts WHERE tenant_id = $1 AND ($2::text IS NULL OR $2 = ANY(tags)) ORDER BY created_at DESC`,
    [tenantId, tagFilter ?? null]
  );
  return rows.map(rowToContact);
}

/** Every distinct tag in use for this tenant — powers the filter dropdown's option list. */
export async function listDistinctTags(tenantId: string): Promise<string[]> {
  const { rows } = await getPool().query(
    `SELECT DISTINCT unnest(tags) AS tag FROM contacts WHERE tenant_id = $1 ORDER BY tag`,
    [tenantId]
  );
  return rows.map((r) => r.tag as string);
}

/**
 * Upserts by (tenant_id, phone) — re-importing the same phone updates the
 * name. `tags`, if given, is unioned into any tags the contact already has
 * (deduped) rather than replacing them — a CSV re-import shouldn't silently
 * wipe tags added by hand since the last import. Use setContactTags() for an
 * explicit full replace (the Contacts page's own tag editor).
 */
export async function upsertContact(tenantId: string, phone: string, name?: string, tags?: string[]): Promise<ContactRecord> {
  const { rows } = await getPool().query(
    `INSERT INTO contacts (tenant_id, phone, name, tags)
     VALUES ($1, $2, $3, COALESCE($4::text[], '{}'))
     ON CONFLICT (tenant_id, phone) DO UPDATE SET
       name = COALESCE(EXCLUDED.name, contacts.name),
       tags = CASE WHEN $4::text[] IS NULL THEN contacts.tags
                    ELSE (SELECT array_agg(DISTINCT t) FROM unnest(contacts.tags || EXCLUDED.tags) AS t) END,
       updated_at = NOW()
     RETURNING *`,
    [tenantId, phone, name ?? null, tags ?? null]
  );
  return rowToContact(rows[0]);
}

/** Explicit full replace — the Contacts page's tag editor uses this, not the merge-on-import behavior above. */
export async function setContactTags(tenantId: string, contactId: string, tags: string[]): Promise<ContactRecord | null> {
  const { rows } = await getPool().query(
    `UPDATE contacts SET tags = $3, updated_at = NOW() WHERE tenant_id = $1 AND id = $2 RETURNING *`,
    [tenantId, contactId, tags]
  );
  return rows[0] ? rowToContact(rows[0]) : null;
}

/** Full replace of the custom-fields object — matches how an "edit fields" form naturally submits the whole thing. */
export async function updateContactAttributes(
  tenantId: string,
  contactId: string,
  attributes: Record<string, unknown>
): Promise<ContactRecord | null> {
  const { rows } = await getPool().query(
    `UPDATE contacts SET attributes = $3, updated_at = NOW() WHERE tenant_id = $1 AND id = $2 RETURNING *`,
    [tenantId, contactId, JSON.stringify(attributes)]
  );
  return rows[0] ? rowToContact(rows[0]) : null;
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
      return { phone: normalizePhone(phoneRaw), name: rest.join(',') || undefined };
    })
    .filter((row) => row.phone.length > 0);
}
