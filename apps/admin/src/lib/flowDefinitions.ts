import { getPool } from './db';

export interface FlowStep {
  question: string;
  /** Up to 3 labels — sent as WhatsApp quick-reply buttons. Omit for free text. */
  options?: string[];
}

export interface FlowDefinitionRecord {
  id: string;
  tenantId: string;
  triggerKeyword: string;
  steps: FlowStep[];
  completionMessage: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

function rowToFlowDefinition(row: Record<string, unknown>): FlowDefinitionRecord {
  return {
    id:                 row.id as string,
    tenantId:           row.tenant_id as string,
    triggerKeyword:     row.trigger_keyword as string,
    steps:              row.steps as FlowStep[],
    completionMessage:  row.completion_message as string,
    isActive:           row.is_active as boolean,
    createdAt:          row.created_at as string,
    updatedAt:          row.updated_at as string,
  };
}

export async function listFlowDefinitions(tenantId: string): Promise<FlowDefinitionRecord[]> {
  const { rows } = await getPool().query(
    `SELECT * FROM flow_definitions WHERE tenant_id = $1 ORDER BY created_at DESC`,
    [tenantId]
  );
  return rows.map(rowToFlowDefinition);
}

const CONSENT_KEYWORDS = new Set(['stop', 'unsubscribe', 'start', 'subscribe']);

/** Same guard the dispatcher enforces at runtime — reject at save time too, so ops gets an immediate error instead of a silently-dead trigger. */
export function validateTriggerKeyword(keyword: string): string | null {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return 'Trigger keyword is required';
  if (CONSENT_KEYWORDS.has(normalized)) return `"${normalized}" is reserved for opt-in/opt-out and can't be used as a trigger`;
  return null;
}

export async function createFlowDefinition(
  tenantId: string, input: { triggerKeyword: string; steps: FlowStep[]; completionMessage: string }
): Promise<FlowDefinitionRecord> {
  const { rows } = await getPool().query(
    `INSERT INTO flow_definitions (tenant_id, trigger_keyword, steps, completion_message)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [tenantId, input.triggerKeyword.trim().toLowerCase(), JSON.stringify(input.steps), input.completionMessage]
  );
  return rowToFlowDefinition(rows[0]);
}

export async function updateFlowDefinition(
  tenantId: string, id: string,
  update: { triggerKeyword?: string; steps?: FlowStep[]; completionMessage?: string; isActive?: boolean }
): Promise<FlowDefinitionRecord | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (update.triggerKeyword !== undefined)    { fields.push(`trigger_keyword = $${i++}`);    values.push(update.triggerKeyword.trim().toLowerCase()); }
  if (update.steps !== undefined)             { fields.push(`steps = $${i++}`);              values.push(JSON.stringify(update.steps)); }
  if (update.completionMessage !== undefined) { fields.push(`completion_message = $${i++}`); values.push(update.completionMessage); }
  if (update.isActive !== undefined)          { fields.push(`is_active = $${i++}`);          values.push(update.isActive); }
  if (!fields.length) {
    const { rows } = await getPool().query(`SELECT * FROM flow_definitions WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
    return rows[0] ? rowToFlowDefinition(rows[0]) : null;
  }
  fields.push(`updated_at = NOW()`);
  values.push(tenantId, id);
  const { rows } = await getPool().query(
    `UPDATE flow_definitions SET ${fields.join(', ')} WHERE tenant_id = $${i++} AND id = $${i} RETURNING *`,
    values
  );
  return rows[0] ? rowToFlowDefinition(rows[0]) : null;
}

export async function deleteFlowDefinition(tenantId: string, id: string): Promise<void> {
  await getPool().query(`DELETE FROM flow_definitions WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
}
