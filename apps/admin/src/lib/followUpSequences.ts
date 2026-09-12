import { getPool } from './db';

export interface FollowUpSequenceRecord {
  id: string;
  tenantId: string;
  campaignId: string;
  delayDays: number;
  hsmTemplateName: string;
  hsmLanguage: string;
  hsmParams: string[];
  isActive: boolean;
  lastRunAt: string | null;
  createdAt: string;
}

function rowToFollowUp(row: Record<string, unknown>): FollowUpSequenceRecord {
  return {
    id:              row.id as string,
    tenantId:        row.tenant_id as string,
    campaignId:      row.campaign_id as string,
    delayDays:       row.delay_days as number,
    hsmTemplateName: row.hsm_template_name as string,
    hsmLanguage:     row.hsm_language as string,
    hsmParams:       (row.hsm_params as string[]) ?? [],
    isActive:        row.is_active as boolean,
    lastRunAt:       row.last_run_at as string | null,
    createdAt:       row.created_at as string,
  };
}

export async function listFollowUpSequences(tenantId: string): Promise<FollowUpSequenceRecord[]> {
  const { rows } = await getPool().query(
    `SELECT * FROM follow_up_sequences WHERE tenant_id = $1 ORDER BY created_at DESC`,
    [tenantId]
  );
  return rows.map(rowToFollowUp);
}

export async function getFollowUpForCampaign(tenantId: string, campaignId: string): Promise<FollowUpSequenceRecord | null> {
  const { rows } = await getPool().query(
    `SELECT * FROM follow_up_sequences WHERE tenant_id = $1 AND campaign_id = $2`,
    [tenantId, campaignId]
  );
  return rows[0] ? rowToFollowUp(rows[0]) : null;
}

export async function createFollowUpSequence(
  tenantId: string,
  input: { campaignId: string; delayDays: number; hsmTemplateName: string; hsmLanguage: string; hsmParams: string[] }
): Promise<FollowUpSequenceRecord> {
  const { rows } = await getPool().query(
    `INSERT INTO follow_up_sequences (tenant_id, campaign_id, delay_days, hsm_template_name, hsm_language, hsm_params)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [tenantId, input.campaignId, input.delayDays, input.hsmTemplateName, input.hsmLanguage, JSON.stringify(input.hsmParams)]
  );
  return rowToFollowUp(rows[0]);
}

export async function setFollowUpActive(tenantId: string, id: string, isActive: boolean): Promise<void> {
  await getPool().query(
    `UPDATE follow_up_sequences SET is_active = $3 WHERE tenant_id = $1 AND id = $2`,
    [tenantId, id, isActive]
  );
}

export async function deleteFollowUpSequence(tenantId: string, id: string): Promise<void> {
  await getPool().query(`DELETE FROM follow_up_sequences WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
}
