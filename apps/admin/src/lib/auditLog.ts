import { getPool } from './db';

export interface AuditLogEntry {
  id: string;
  tenantId: string | null;
  adminUserId: string | null;
  adminEmail: string | null;
  action: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export async function recordAuditEvent(input: {
  tenantId?: string;
  adminUserId: string;
  action: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await getPool().query(
    `INSERT INTO admin_audit_log (tenant_id, admin_user_id, action, details)
     VALUES ($1, $2, $3, $4)`,
    [input.tenantId ?? null, input.adminUserId, input.action, JSON.stringify(input.details ?? {})]
  );
}

export async function listAuditLog(tenantId: string, limit = 30): Promise<AuditLogEntry[]> {
  const { rows } = await getPool().query(
    `SELECT l.*, u.email AS admin_email
       FROM admin_audit_log l
       LEFT JOIN admin_users u ON u.id = l.admin_user_id
      WHERE l.tenant_id = $1
      ORDER BY l.created_at DESC
      LIMIT $2`,
    [tenantId, limit]
  );
  return rows.map((row) => ({
    id:           row.id as string,
    tenantId:     row.tenant_id as string | null,
    adminUserId:  row.admin_user_id as string | null,
    adminEmail:   row.admin_email as string | null,
    action:       row.action as string,
    details:      row.details as Record<string, unknown>,
    createdAt:    row.created_at as string,
  }));
}
