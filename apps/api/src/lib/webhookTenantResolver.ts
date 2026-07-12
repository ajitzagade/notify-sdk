import { getPool } from './db';

/** Used by TenantWebhookRouter to map an inbound webhook's phone_number_id to a tenant. */
export async function resolveTenantIdByPhoneNumberId(phoneNumberId: string): Promise<string | null> {
  const { rows } = await getPool().query(
    `SELECT tenant_id FROM tenant_wa_credentials WHERE phone_number_id = $1 LIMIT 1`,
    [phoneNumberId]
  );
  return rows[0] ? (rows[0].tenant_id as string) : null;
}
