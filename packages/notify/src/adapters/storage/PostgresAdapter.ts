import { IStorageAdapter, NotifyEvent, RecipientPreference } from '../../types';

/**
 * PostgresAdapter — persistent storage using PostgreSQL.
 * Requires: npm install pg @types/pg
 *
 * Run the migrations in src/adapters/storage/migrations/ before use.
 *
 * Every row is scoped to a tenant. Callers that don't pass a `tenantId` (the
 * original single-tenant usage) are scoped to LEGACY_TENANT_ID instead of
 * being left unscoped — this keeps existing single-tenant deployments working
 * unchanged while guaranteeing no query can ever return another tenant's rows,
 * even accidentally.
 */
export const LEGACY_TENANT_ID = '00000000-0000-0000-0000-000000000000';

export class PostgresAdapter implements IStorageAdapter {
  private tenantId: string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private pool: any, tenantId?: string) {
    this.tenantId = tenantId ?? LEGACY_TENANT_ID;
  }

  async logEvent(event: Partial<NotifyEvent>): Promise<string> {
    const id = event.id ?? crypto.randomUUID();
    await this.pool.query(
      `INSERT INTO notify_log
         (id, tenant_id, to_phone, template, status, tags, meta, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        id,
        this.tenantId,
        event.to ?? '',
        event.template ?? '',
        event.status ?? 'queued',
        JSON.stringify(event.tags ?? []),
        JSON.stringify(event.meta ?? {}),
      ]
    );
    return id;
  }

  async updateEvent(id: string, update: Partial<NotifyEvent>): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (update.status !== undefined) {
      fields.push(`status = $${i++}`); values.push(update.status);
    }
    if (update.waMessageId !== undefined) {
      fields.push(`wa_message_id = $${i++}`); values.push(update.waMessageId);
    }
    if (update.sentAt !== undefined) {
      fields.push(`sent_at = $${i++}`); values.push(update.sentAt);
    }
    if (update.deliveredAt !== undefined) {
      fields.push(`delivered_at = $${i++}`); values.push(update.deliveredAt);
    }
    if (update.readAt !== undefined) {
      fields.push(`read_at = $${i++}`); values.push(update.readAt);
    }
    if (update.error !== undefined) {
      fields.push(`error_message = $${i++}`); values.push(update.error);
    }

    if (!fields.length) return;
    values.push(id, this.tenantId);
    await this.pool.query(
      `UPDATE notify_log SET ${fields.join(', ')} WHERE id = $${i} AND tenant_id = $${i + 1}`,
      values
    );
  }

  async updateByWaMessageId(waMessageId: string, update: Partial<NotifyEvent>): Promise<void> {
    const { rows } = await this.pool.query(
      `SELECT id FROM notify_log WHERE wa_message_id = $1 AND tenant_id = $2 LIMIT 1`,
      [waMessageId, this.tenantId]
    );
    if (rows[0]) await this.updateEvent(rows[0].id as string, update);
  }

  async getEvent(id: string): Promise<NotifyEvent | null> {
    const { rows } = await this.pool.query(
      `SELECT * FROM notify_log WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [id, this.tenantId]
    );
    if (!rows[0]) return null;
    return this.rowToEvent(rows[0]);
  }

  async getPreference(phone: string): Promise<RecipientPreference | null> {
    const { rows } = await this.pool.query(
      `SELECT * FROM notify_preferences WHERE phone = $1 AND tenant_id = $2 LIMIT 1`,
      [phone, this.tenantId]
    );
    if (!rows[0]) return null;
    return {
      phone:       rows[0].phone as string,
      optedIn:     rows[0].opted_in as boolean,
      mutedUntil:  rows[0].muted_until ? new Date(rows[0].muted_until as string) : undefined,
      timezone:    rows[0].timezone as string | undefined,
      quietHours:  rows[0].quiet_hours_start != null
        ? { start: rows[0].quiet_hours_start as number, end: rows[0].quiet_hours_end as number }
        : undefined,
    };
  }

  async setPreference(phone: string, pref: Partial<RecipientPreference>): Promise<void> {
    await this.pool.query(
      `INSERT INTO notify_preferences (tenant_id, phone, opted_in, muted_until, timezone)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, phone) DO UPDATE SET
         opted_in    = COALESCE(EXCLUDED.opted_in,    notify_preferences.opted_in),
         muted_until = COALESCE(EXCLUDED.muted_until, notify_preferences.muted_until),
         timezone    = COALESCE(EXCLUDED.timezone,    notify_preferences.timezone),
         updated_at  = NOW()`,
      [this.tenantId, phone, pref.optedIn, pref.mutedUntil ?? null, pref.timezone ?? null]
    );
  }

  async getRecentEvents(limit = 50): Promise<NotifyEvent[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM notify_log WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [this.tenantId, limit]
    );
    return rows.map((r: Record<string, unknown>) => this.rowToEvent(r));
  }

  private rowToEvent(row: Record<string, unknown>): NotifyEvent {
    return {
      id:          row.id as string,
      to:          row.to_phone as string,
      template:    row.template as string,
      status:      row.status as NotifyEvent['status'],
      waMessageId: row.wa_message_id as string | undefined,
      sentAt:      row.sent_at ? new Date(row.sent_at as string) : undefined,
      deliveredAt: row.delivered_at ? new Date(row.delivered_at as string) : undefined,
      readAt:      row.read_at ? new Date(row.read_at as string) : undefined,
      tags:        parseJsonbColumn<string[]>(row.tags),
      meta:        parseJsonbColumn<Record<string, unknown>>(row.meta),
      error:       row.error_message as string | undefined,
    };
  }
}

/**
 * node-postgres already parses jsonb columns into native JS values — calling
 * JSON.parse() on the result (the previous behavior here) throws on anything
 * that isn't a plain string (e.g. `[]`). Only parse if it actually came back
 * as a string; otherwise use the value as-is.
 */
function parseJsonbColumn<T>(value: unknown): T | undefined {
  if (value == null) return undefined;
  return typeof value === 'string' ? (JSON.parse(value) as T) : (value as T);
}
