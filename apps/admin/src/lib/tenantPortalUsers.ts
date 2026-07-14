import { hashPassword } from '@orgname/notify';
import { getPool } from './db';

export interface PortalUserRecord {
  id: string;
  tenantId: string;
  email: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

function rowToPortalUser(row: Record<string, unknown>): PortalUserRecord {
  return {
    id:          row.id as string,
    tenantId:    row.tenant_id as string,
    email:       row.email as string,
    isActive:    row.is_active as boolean,
    lastLoginAt: row.last_login_at as string | null,
    createdAt:   row.created_at as string,
  };
}

export async function listPortalUsers(tenantId: string): Promise<PortalUserRecord[]> {
  const { rows } = await getPool().query(
    `SELECT * FROM tenant_portal_users WHERE tenant_id = $1 ORDER BY created_at DESC`,
    [tenantId]
  );
  return rows.map(rowToPortalUser);
}

/** Throws (unique-constraint violation) if the email is already in use — by this tenant or any other. */
export async function createPortalUser(input: {
  tenantId: string;
  email: string;
  password: string;
  createdByAdminId: string;
}): Promise<PortalUserRecord> {
  const { hash, salt } = await hashPassword(input.password);
  const { rows } = await getPool().query(
    `INSERT INTO tenant_portal_users (tenant_id, email, password_hash, password_salt, created_by_admin_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [input.tenantId, input.email.toLowerCase(), hash, salt, input.createdByAdminId]
  );
  return rowToPortalUser(rows[0]);
}

export async function setPortalUserActive(tenantId: string, userId: string, isActive: boolean): Promise<boolean> {
  const { rowCount } = await getPool().query(
    `UPDATE tenant_portal_users SET is_active = $1 WHERE id = $2 AND tenant_id = $3`,
    [isActive, userId, tenantId]
  );
  return (rowCount ?? 0) > 0;
}

/** For login — looks up by email alone (no tenant selector at login time). */
export async function findPortalUserByEmailForLogin(email: string): Promise<{
  id: string; tenantId: string; email: string; passwordHash: string; passwordSalt: string; isActive: boolean;
} | null> {
  const { rows } = await getPool().query(
    `SELECT id, tenant_id, email, password_hash, password_salt, is_active
       FROM tenant_portal_users WHERE email = $1 LIMIT 1`,
    [email.toLowerCase()]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id:           row.id as string,
    tenantId:     row.tenant_id as string,
    email:        row.email as string,
    passwordHash: row.password_hash as string,
    passwordSalt: row.password_salt as string,
    isActive:     row.is_active as boolean,
  };
}

export async function touchPortalUserLastLogin(userId: string): Promise<void> {
  await getPool().query(`UPDATE tenant_portal_users SET last_login_at = NOW() WHERE id = $1`, [userId]);
}
