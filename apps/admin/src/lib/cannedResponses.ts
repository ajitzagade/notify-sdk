import { getPool } from './db';

export interface CannedResponse {
  id: string;
  tenantId: string;
  label: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

function rowToCannedResponse(row: Record<string, unknown>): CannedResponse {
  return {
    id:        row.id as string,
    tenantId:  row.tenant_id as string,
    label:     row.label as string,
    body:      row.body as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function listCannedResponses(tenantId: string): Promise<CannedResponse[]> {
  const { rows } = await getPool().query(
    `SELECT * FROM canned_responses WHERE tenant_id = $1 ORDER BY label ASC`,
    [tenantId]
  );
  return rows.map(rowToCannedResponse);
}

export async function createCannedResponse(tenantId: string, label: string, body: string): Promise<CannedResponse> {
  const { rows } = await getPool().query(
    `INSERT INTO canned_responses (tenant_id, label, body) VALUES ($1, $2, $3) RETURNING *`,
    [tenantId, label, body]
  );
  return rowToCannedResponse(rows[0]);
}

/** Scoped to tenantId in the WHERE clause, not just the id — the one thing that must never regress here is a tenant editing another tenant's snippet by guessing an id. */
export async function updateCannedResponse(
  tenantId: string, id: string, update: { label?: string; body?: string }
): Promise<CannedResponse | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (update.label !== undefined) { fields.push(`label = $${i++}`); values.push(update.label); }
  if (update.body !== undefined)  { fields.push(`body = $${i++}`);  values.push(update.body); }
  if (!fields.length) {
    const { rows } = await getPool().query(`SELECT * FROM canned_responses WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
    return rows[0] ? rowToCannedResponse(rows[0]) : null;
  }
  fields.push(`updated_at = NOW()`);
  values.push(tenantId, id);
  const { rows } = await getPool().query(
    `UPDATE canned_responses SET ${fields.join(', ')} WHERE tenant_id = $${i++} AND id = $${i} RETURNING *`,
    values
  );
  return rows[0] ? rowToCannedResponse(rows[0]) : null;
}

export async function deleteCannedResponse(tenantId: string, id: string): Promise<void> {
  await getPool().query(`DELETE FROM canned_responses WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
}
