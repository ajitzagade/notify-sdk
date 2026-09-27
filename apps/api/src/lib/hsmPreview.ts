import { renderHsmBody, HsmComponent } from '@orgname/notify';
import { getPool } from './db';

/**
 * Resolves the real rendered body text of an HSM template send for
 * notify_log.body_preview — the wire payload only carries the template
 * name + parameters, so without this thread views show "[Template: name]"
 * instead of the actual sentence. Best-effort: any miss (template not
 * synced, no BODY component) returns undefined and the SDK's placeholder
 * fallback applies. Mirrors apps/admin/src/lib/hsmPreview.ts.
 */
export async function getHsmBodyPreview(
  tenantId: string,
  templateName: string,
  language?: string,
  components?: HsmComponent[]
): Promise<string | undefined> {
  try {
    const { rows } = await getPool().query(
      `SELECT components FROM wa_templates
        WHERE tenant_id = $1 AND name = $2
        ORDER BY (language = $3) DESC NULLS LAST
        LIMIT 1`,
      [tenantId, templateName, language ?? null]
    );
    if (!rows[0]) return undefined;
    return renderHsmBody(
      rows[0].components as Array<Record<string, unknown>>,
      components as Array<{ type: string; parameters?: Array<{ type: string; text?: string }> }> | undefined
    );
  } catch {
    return undefined;
  }
}
