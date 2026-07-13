import { getPool } from './db';

export interface AdminUserSummary {
  id: string;
  email: string;
}

/** Minimal list for populating "assign to" pickers — not a full admin-user management surface. */
export async function listAdminUsers(): Promise<AdminUserSummary[]> {
  const { rows } = await getPool().query(`SELECT id, email FROM admin_users WHERE is_active = true ORDER BY email`);
  return rows.map((r) => ({ id: r.id as string, email: r.email as string }));
}
