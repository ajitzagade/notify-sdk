import { getPool } from './db';

export interface CampaignRecord {
  id: string;
  tenantId: string;
  name: string;
  broadcastListId: string;
  hsmTemplateName: string;
  hsmLanguage: string;
  hsmParams: string[];
  status: 'draft' | 'running' | 'completed' | 'failed';
  stats: Record<string, unknown> | null;
  createdAt: string;
  completedAt: string | null;
}

function rowToCampaign(row: Record<string, unknown>): CampaignRecord {
  return {
    id:               row.id as string,
    tenantId:         row.tenant_id as string,
    name:             row.name as string,
    broadcastListId:  row.broadcast_list_id as string,
    hsmTemplateName:  row.hsm_template_name as string,
    hsmLanguage:      row.hsm_language as string,
    hsmParams:        (row.hsm_params as string[]) ?? [],
    status:           row.status as CampaignRecord['status'],
    stats:            row.stats as Record<string, unknown> | null,
    createdAt:        row.created_at as string,
    completedAt:      row.completed_at as string | null,
  };
}

export async function listCampaigns(tenantId: string): Promise<CampaignRecord[]> {
  const { rows } = await getPool().query(
    `SELECT * FROM campaigns WHERE tenant_id = $1 ORDER BY created_at DESC`,
    [tenantId]
  );
  return rows.map(rowToCampaign);
}

export async function getCampaign(tenantId: string, campaignId: string): Promise<CampaignRecord | null> {
  const { rows } = await getPool().query(
    `SELECT * FROM campaigns WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
    [tenantId, campaignId]
  );
  return rows[0] ? rowToCampaign(rows[0]) : null;
}

export async function createCampaign(input: {
  tenantId: string;
  name: string;
  broadcastListId: string;
  hsmTemplateName: string;
  hsmLanguage: string;
  hsmParams: string[];
  createdByAdminId: string;
}): Promise<CampaignRecord> {
  const { rows } = await getPool().query(
    `INSERT INTO campaigns (tenant_id, name, broadcast_list_id, hsm_template_name, hsm_language, hsm_params, created_by_admin_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      input.tenantId, input.name, input.broadcastListId,
      input.hsmTemplateName, input.hsmLanguage, JSON.stringify(input.hsmParams),
      input.createdByAdminId,
    ]
  );
  return rowToCampaign(rows[0]);
}

export async function markCampaignRunning(campaignId: string): Promise<void> {
  await getPool().query(`UPDATE campaigns SET status = 'running' WHERE id = $1`, [campaignId]);
}

export async function completeCampaign(
  campaignId: string,
  status: 'completed' | 'failed',
  stats: Record<string, unknown>
): Promise<void> {
  await getPool().query(
    `UPDATE campaigns SET status = $1, stats = $2, completed_at = NOW() WHERE id = $3`,
    [status, JSON.stringify(stats), campaignId]
  );
}
