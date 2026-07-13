import { decryptSecret, resolveKeyForVersion } from '@orgname/notify';
import { getPool } from './db';
import { getMasterKeyRing } from './security';
import type { AiProvider } from './ai/generate';

export interface DecryptedAiConfig {
  provider: AiProvider;
  model: string;
  apiKey: string;
  systemPrompt: string | null;
  autoReplyEnabled: boolean;
  autoReplyMaxPerConversation: number;
}

/**
 * Read-only here — apps/api only dispatches auto-replies against inbound
 * webhooks; the config itself is only ever written from apps/admin's AI
 * assistant tab (see apps/admin/src/lib/aiConfig.ts, same schema).
 */
export async function getDecryptedAiConfig(tenantId: string): Promise<DecryptedAiConfig | null> {
  const { rows } = await getPool().query(
    `SELECT provider, model, system_prompt, auto_reply_enabled, auto_reply_max_per_conversation,
            api_key_ciphertext, api_key_iv, api_key_tag, key_version
       FROM ai_configs WHERE tenant_id = $1 LIMIT 1`,
    [tenantId]
  );
  const row = rows[0];
  if (!row || !row.api_key_ciphertext) return null;

  const masterKey = resolveKeyForVersion(getMasterKeyRing(), row.key_version as number);
  const apiKey = decryptSecret(
    { ciphertext: row.api_key_ciphertext as string, iv: row.api_key_iv as string, tag: row.api_key_tag as string },
    tenantId,
    masterKey,
    row.key_version as number
  );

  return {
    provider: row.provider as AiProvider,
    model: row.model as string,
    apiKey,
    systemPrompt: row.system_prompt as string | null,
    autoReplyEnabled: row.auto_reply_enabled as boolean,
    autoReplyMaxPerConversation: row.auto_reply_max_per_conversation as number,
  };
}
