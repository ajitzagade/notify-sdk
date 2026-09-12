// Server-side half of the starter template library: takes a catalog key,
// submits the template to Meta on the tenant's own WABA, and mirrors Meta's
// response into wa_templates so it shows up alongside synced templates
// immediately (status PENDING until Meta approves — the normal sync path
// refreshes it from there).

import { getCredentialStatus } from './tenants';
import { getDecryptedTenantCredentials } from './tenantRegistry';
import { createWhatsAppTemplate } from './metaGraph';
import { getStarterTemplate, starterToMetaComponents } from './starterTemplates';
import { upsertTemplates } from './templates';

export type StarterSubmitResult =
  | { ok: true; name: string; status: string }
  | { ok: false; error: string; statusCode: number };

export async function submitStarterTemplate(tenantId: string, key: string): Promise<StarterSubmitResult> {
  const starter = getStarterTemplate(key);
  if (!starter) {
    return { ok: false, error: 'Unknown starter template', statusCode: 400 };
  }

  const status = await getCredentialStatus(tenantId);
  if (!status.configured) {
    return { ok: false, error: 'WhatsApp credentials are not configured yet', statusCode: 409 };
  }
  if (!status.wabaId) {
    return {
      ok: false,
      error: 'A WhatsApp Business Account ID is required to submit templates — add it on the Credentials step',
      statusCode: 409,
    };
  }

  const creds = await getDecryptedTenantCredentials(tenantId);
  const result = await createWhatsAppTemplate(creds.accessToken, status.wabaId, {
    name:       starter.key,
    language:   starter.language,
    category:   starter.metaCategory,
    components: starterToMetaComponents(starter),
  });

  if (!result.ok) {
    return { ok: false, error: result.error ?? 'Meta rejected the template submission', statusCode: 502 };
  }

  const metaStatus = result.status ?? 'PENDING';
  if (result.id) {
    await upsertTemplates(tenantId, [
      {
        id:         result.id,
        name:       starter.key,
        language:   starter.language,
        category:   result.category ?? starter.metaCategory,
        status:     metaStatus,
        components: starterToMetaComponents(starter) as never,
      },
    ]);
  }

  return { ok: true, name: starter.key, status: metaStatus };
}
