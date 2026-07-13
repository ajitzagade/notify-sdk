import { encryptSecret, decryptSecret, resolveKeyForVersion } from '@orgname/notify';
import { getPool } from './db';
import { getMasterKeyRing } from './security';
import type { AiProvider } from './ai/generate';

export interface AiConfigStatus {
  configured: boolean;
  provider: AiProvider | null;
  model: string | null;
  systemPrompt: string | null;
  autoReplyEnabled: boolean;
  autoReplyMaxPerConversation: number;
}

export interface DecryptedAiConfig {
  provider: AiProvider;
  model: string;
  apiKey: string;
  systemPrompt: string | null;
  autoReplyEnabled: boolean;
  autoReplyMaxPerConversation: number;
}

export async function getAiConfigStatus(tenantId: string): Promise<AiConfigStatus> {
  const { rows } = await getPool().query(
    `SELECT provider, model, system_prompt, auto_reply_enabled, auto_reply_max_per_conversation, api_key_ciphertext
       FROM ai_configs WHERE tenant_id = $1 LIMIT 1`,
    [tenantId]
  );
  const row = rows[0];
  if (!row) {
    return {
      configured: false,
      provider: null,
      model: null,
      systemPrompt: null,
      autoReplyEnabled: false,
      autoReplyMaxPerConversation: 3,
    };
  }
  return {
    configured: Boolean(row.api_key_ciphertext),
    provider: row.provider as AiProvider,
    model: row.model as string,
    systemPrompt: row.system_prompt as string | null,
    autoReplyEnabled: row.auto_reply_enabled as boolean,
    autoReplyMaxPerConversation: row.auto_reply_max_per_conversation as number,
  };
}

/** Decrypts the BYO key — used only by the auto-reply dispatcher and the "Test key" action, never returned to the client. */
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

export async function saveAiConfig(input: {
  tenantId: string;
  provider: AiProvider;
  model: string;
  /** Omit to keep the currently-saved key (mirrors CredentialsForm's "leave blank to keep current"). */
  apiKey?: string;
  systemPrompt: string | null;
  autoReplyEnabled: boolean;
  autoReplyMaxPerConversation: number;
}): Promise<void> {
  if (input.apiKey) {
    const ring = getMasterKeyRing();
    const enc = encryptSecret(input.apiKey, input.tenantId, ring.currentKey, ring.currentVersion);
    await getPool().query(
      `INSERT INTO ai_configs
         (tenant_id, provider, model, api_key_ciphertext, api_key_iv, api_key_tag, key_version,
          system_prompt, auto_reply_enabled, auto_reply_max_per_conversation)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (tenant_id) DO UPDATE SET
         provider                        = EXCLUDED.provider,
         model                           = EXCLUDED.model,
         api_key_ciphertext              = EXCLUDED.api_key_ciphertext,
         api_key_iv                      = EXCLUDED.api_key_iv,
         api_key_tag                     = EXCLUDED.api_key_tag,
         key_version                     = EXCLUDED.key_version,
         system_prompt                   = EXCLUDED.system_prompt,
         auto_reply_enabled              = EXCLUDED.auto_reply_enabled,
         auto_reply_max_per_conversation = EXCLUDED.auto_reply_max_per_conversation,
         updated_at                      = NOW()`,
      [
        input.tenantId, input.provider, input.model,
        enc.ciphertext, enc.iv, enc.tag, ring.currentVersion,
        input.systemPrompt, input.autoReplyEnabled, input.autoReplyMaxPerConversation,
      ]
    );
    return;
  }

  const { rowCount } = await getPool().query(
    `UPDATE ai_configs SET
       provider = $2, model = $3, system_prompt = $4,
       auto_reply_enabled = $5, auto_reply_max_per_conversation = $6, updated_at = NOW()
     WHERE tenant_id = $1`,
    [input.tenantId, input.provider, input.model, input.systemPrompt, input.autoReplyEnabled, input.autoReplyMaxPerConversation]
  );
  if (rowCount === 0) {
    throw new Error('No API key on file yet — enter one before saving.');
  }
}
