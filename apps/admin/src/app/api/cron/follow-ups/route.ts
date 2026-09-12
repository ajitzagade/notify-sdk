import { NextRequest, NextResponse } from 'next/server';
import type { HsmComponent } from '@orgname/notify';
import { getPool } from '@/lib/db';
import { getTenantRegistry } from '@/lib/tenantRegistry';

export const maxDuration = 60;

interface DueSequenceRow {
  id: string;
  tenant_id: string;
  campaign_id: string;
  delay_days: number;
  hsm_template_name: string;
  hsm_language: string;
  hsm_params: string[];
  broadcast_id: string;
}

/**
 * Runs once/day (see apps/admin/vercel.json's crons entry — Vercel Hobby caps
 * cron frequency at once/day, which is why delay_days is a floor, not a
 * precise deadline). Vercel signs its own cron requests with an Authorization
 * header matching CRON_SECRET when that env var is set — this route rejects
 * anything else, since it has no per-tenant auth of its own (it spans every
 * tenant by design).
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pool = getPool();
  const { rows: dueSequences } = await pool.query<DueSequenceRow>(
    `SELECT fus.id, fus.tenant_id, fus.campaign_id, fus.delay_days, fus.hsm_template_name, fus.hsm_language, fus.hsm_params, c.broadcast_id
       FROM follow_up_sequences fus
       JOIN campaigns c ON c.id = fus.campaign_id
      WHERE fus.is_active = true AND c.status = 'completed' AND c.broadcast_id IS NOT NULL`
  );

  const results: Array<{ sequenceId: string; attempted: number; error?: string }> = [];

  for (const seq of dueSequences) {
    try {
      const { rows: eligible } = await pool.query<{ to_phone: string }>(
        `SELECT DISTINCT nl.to_phone
           FROM notify_log nl
          WHERE nl.tenant_id = $1
            AND nl.meta->>'broadcastId' = $2
            AND nl.status IN ('sent', 'delivered', 'read')
            AND nl.sent_at <= NOW() - ($3 || ' days')::interval
            AND NOT EXISTS (
              SELECT 1 FROM message_replies mr
               WHERE mr.tenant_id = $1 AND mr.in_reply_to_wa_message_id = nl.wa_message_id
            )
            AND NOT EXISTS (
              SELECT 1 FROM follow_up_sends fs
               WHERE fs.follow_up_sequence_id = $4 AND fs.phone = nl.to_phone
            )`,
        [seq.tenant_id, seq.broadcast_id, seq.delay_days, seq.id]
      );

      if (!eligible.length) {
        results.push({ sequenceId: seq.id, attempted: 0 });
        continue;
      }

      const components: HsmComponent[] = seq.hsm_params.length
        ? [{ type: 'body', parameters: seq.hsm_params.map((v) => ({ type: 'text' as const, text: v })) }]
        : [];

      const client = await getTenantRegistry().getClient(seq.tenant_id);
      await client.sendBulk({
        recipients:  eligible.map((r) => r.to_phone),
        template:    'text',
        hsmTemplate: { name: seq.hsm_template_name, language: seq.hsm_language, components: components.length ? components : undefined },
        batchSize:             50,
        delayBetweenBatchesMs: 1000,
      });

      // Mark every attempted phone as handled regardless of individual send
      // outcome — same no-automatic-retry semantics as a regular campaign run.
      await pool.query(
        `INSERT INTO follow_up_sends (follow_up_sequence_id, phone)
         SELECT $1, unnest($2::text[])
         ON CONFLICT (follow_up_sequence_id, phone) DO NOTHING`,
        [seq.id, eligible.map((r) => r.to_phone)]
      );
      await pool.query(`UPDATE follow_up_sequences SET last_run_at = NOW() WHERE id = $1`, [seq.id]);

      results.push({ sequenceId: seq.id, attempted: eligible.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cron/follow-ups] sequence ${seq.id} failed:`, err);
      results.push({ sequenceId: seq.id, attempted: 0, error: msg });
    }
  }

  return NextResponse.json({ ok: true, sequencesChecked: dueSequences.length, results });
}
