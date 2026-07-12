import {
  TenantClientRegistry,
  TenantCredentialsProvider,
  TenantWaCredentials,
  decryptSecret,
} from '@orgname/notify';
import { getPool } from './db';
import { getMasterKey } from './security';

class PgTenantCredentialsProvider implements TenantCredentialsProvider {
  async getCredentials(tenantId: string): Promise<TenantWaCredentials> {
    const { rows } = await getPool().query(
      `SELECT phone_number_id, waba_id, verify_token, key_version,
              access_token_ciphertext, access_token_iv, access_token_tag,
              app_secret_ciphertext, app_secret_iv, app_secret_tag
         FROM tenant_wa_credentials WHERE tenant_id = $1 LIMIT 1`,
      [tenantId]
    );
    const row = rows[0];
    if (!row) {
      throw new Error(`[admin] No WhatsApp credentials configured for tenant ${tenantId}`);
    }

    const masterKey  = getMasterKey();
    const keyVersion = row.key_version as number;

    const accessToken = decryptSecret(
      {
        ciphertext: row.access_token_ciphertext as string,
        iv:         row.access_token_iv as string,
        tag:        row.access_token_tag as string,
      },
      tenantId,
      masterKey,
      keyVersion
    );

    const appSecret = row.app_secret_ciphertext
      ? decryptSecret(
          {
            ciphertext: row.app_secret_ciphertext as string,
            iv:         row.app_secret_iv as string,
            tag:        row.app_secret_tag as string,
          },
          tenantId,
          masterKey,
          keyVersion
        )
      : undefined;

    return {
      accessToken,
      phoneNumberId: row.phone_number_id as string,
      wabaId:        row.waba_id as string | undefined,
      verifyToken:   row.verify_token as string,
      appSecret,
    };
  }
}

let registry: TenantClientRegistry | null = null;

export function getTenantRegistry(): TenantClientRegistry {
  if (registry) return registry;
  registry = new TenantClientRegistry({
    credentialsProvider: new PgTenantCredentialsProvider(),
    pool: getPool(),
    defaults: {
      timezone:   'Asia/Kolkata',
      quietHours: { start: 22, end: 8 },
    },
  });
  return registry;
}
