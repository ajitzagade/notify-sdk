import { getPool } from './db';

export interface BroadcastListRecord {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  memberCount: number;
  createdAt: string;
}

function rowToList(row: Record<string, unknown>): BroadcastListRecord {
  return {
    id:           row.id as string,
    tenantId:     row.tenant_id as string,
    name:         row.name as string,
    description:  row.description as string | null,
    memberCount:  Number(row.member_count ?? 0),
    createdAt:    row.created_at as string,
  };
}

export async function listBroadcastLists(tenantId: string): Promise<BroadcastListRecord[]> {
  const { rows } = await getPool().query(
    `SELECT l.*, COUNT(m.contact_id) AS member_count
       FROM broadcast_lists l
       LEFT JOIN broadcast_list_members m ON m.list_id = l.id
      WHERE l.tenant_id = $1
      GROUP BY l.id
      ORDER BY l.created_at DESC`,
    [tenantId]
  );
  return rows.map(rowToList);
}

/** Finds an existing list by name or creates it — used by CSV import's "add to list" step. */
export async function findOrCreateBroadcastList(tenantId: string, name: string, description?: string): Promise<BroadcastListRecord> {
  const { rows } = await getPool().query(
    `INSERT INTO broadcast_lists (tenant_id, name, description)
     VALUES ($1, $2, $3)
     ON CONFLICT (tenant_id, name) DO UPDATE SET name = EXCLUDED.name
     RETURNING *, (SELECT COUNT(*) FROM broadcast_list_members WHERE list_id = broadcast_lists.id) AS member_count`,
    [tenantId, name, description ?? null]
  );
  return rowToList(rows[0]);
}

export async function addMembersToList(listId: string, contactIds: string[]): Promise<void> {
  if (!contactIds.length) return;
  const pool = getPool();
  const values = contactIds.map((_, i) => `($1, $${i + 2})`).join(', ');
  await pool.query(
    `INSERT INTO broadcast_list_members (list_id, contact_id) VALUES ${values} ON CONFLICT DO NOTHING`,
    [listId, ...contactIds]
  );
}

/** Phone numbers of every member — what a campaign actually sends to. */
export async function getListPhones(listId: string): Promise<string[]> {
  const { rows } = await getPool().query(
    `SELECT c.phone FROM broadcast_list_members m
       JOIN contacts c ON c.id = m.contact_id
      WHERE m.list_id = $1`,
    [listId]
  );
  return rows.map((r) => r.phone as string);
}
