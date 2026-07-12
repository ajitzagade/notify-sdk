import type { MetaTemplateSummary } from '@orgname/notify';
import { getPool } from './db';

export interface TemplateRecord {
  id: string;
  tenantId: string;
  metaTemplateId: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components: MetaTemplateSummary['components'];
  lastSyncedAt: string;
}

function rowToTemplate(row: Record<string, unknown>): TemplateRecord {
  return {
    id:              row.id as string,
    tenantId:        row.tenant_id as string,
    metaTemplateId:  row.meta_template_id as string,
    name:            row.name as string,
    language:        row.language as string,
    category:        row.category as string,
    status:          row.status as string,
    components:      row.components as MetaTemplateSummary['components'],
    lastSyncedAt:    row.last_synced_at as string,
  };
}

export async function listTemplates(tenantId: string): Promise<TemplateRecord[]> {
  const { rows } = await getPool().query(
    `SELECT * FROM wa_templates WHERE tenant_id = $1 ORDER BY name`,
    [tenantId]
  );
  return rows.map(rowToTemplate);
}

/** Upserts Meta's current template list, replacing any stale local copies. */
export async function upsertTemplates(tenantId: string, templates: MetaTemplateSummary[]): Promise<void> {
  const pool = getPool();
  for (const t of templates) {
    await pool.query(
      `INSERT INTO wa_templates (tenant_id, meta_template_id, name, language, category, status, components, last_synced_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (tenant_id, meta_template_id) DO UPDATE SET
         name           = EXCLUDED.name,
         language       = EXCLUDED.language,
         category       = EXCLUDED.category,
         status         = EXCLUDED.status,
         components     = EXCLUDED.components,
         last_synced_at = NOW()`,
      [tenantId, t.id, t.name, t.language, t.category, t.status, JSON.stringify(t.components ?? [])]
    );
  }
}
