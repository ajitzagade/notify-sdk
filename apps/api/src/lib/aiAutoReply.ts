import type { InboundReply, NotifyClient } from '@orgname/notify';
import { getPool } from './db';
import { getDecryptedAiConfig } from './aiConfig';
import { generateReply } from './ai/generate';

const HANDOFF_SENTINEL = '[[HANDOFF]]';
const MAX_QUOTE_LEN = 160;

const DEFAULT_SYSTEM_PROMPT =
  'You are a helpful WhatsApp customer support assistant. Keep replies short and friendly. ' +
  `If you cannot confidently help, or the customer asks for a human, reply with exactly: ${HANDOFF_SENTINEL}`;

interface ThreadState {
  aiReplyCount: number;
  aiAutoreplyDisabled: boolean;
}

async function getThreadState(tenantId: string, phone: string): Promise<ThreadState | null> {
  const { rows } = await getPool().query(
    `SELECT ai_reply_count, ai_autoreply_disabled FROM notify_preferences WHERE tenant_id = $1 AND phone = $2`,
    [tenantId, phone]
  );
  const row = rows[0];
  return row ? { aiReplyCount: row.ai_reply_count as number, aiAutoreplyDisabled: row.ai_autoreply_disabled as boolean } : null;
}

/** Atomic cap-check-and-increment — see claim_ai_reply_slot in migration 013 (packages/notify). */
async function claimReplySlot(tenantId: string, phone: string, maxReplies: number): Promise<boolean> {
  const { rows } = await getPool().query(`SELECT claim_ai_reply_slot($1, $2, $3) AS claimed`, [tenantId, phone, maxReplies]);
  return rows[0]?.claimed === true;
}

async function markHandoff(tenantId: string, phone: string, summary: string): Promise<void> {
  await getPool().query(
    `UPDATE notify_preferences SET ai_autoreply_disabled = true, ai_handoff_summary = $3 WHERE tenant_id = $1 AND phone = $2`,
    [tenantId, phone, summary]
  );
}

/** Deterministic (no extra LLM call) note left when the bot bails — mirrors wacrm's buildHandoffSummary. */
function buildHandoffSummary(replyCount: number, lastCustomerMessage: string): string {
  const replies = replyCount <= 0 ? 'without replying' : `after ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`;
  const collapsed = lastCustomerMessage.replace(/\s+/g, ' ').trim();
  const quote = collapsed.length > MAX_QUOTE_LEN ? `${collapsed.slice(0, MAX_QUOTE_LEN - 1).trimEnd()}…` : collapsed;
  return `AI agent handed off ${replies}. Last customer message: "${quote}"`;
}

/**
 * AI auto-reply for a freshly-arrived inbound message. Registered as an
 * `eventBus.on('reply', ...)` listener at tenant-client construction time
 * (see tenantRegistry.ts) — never wired into WebhookHandler.ts itself. This
 * is the live copy: real inbound WhatsApp webhooks land on apps/api's
 * /v1/webhook/whatsapp route, not apps/admin (admin has no webhook receiver
 * and never sees a 'reply' event fire) — see apps/admin/src/lib/aiAutoReply.ts
 * for the sibling copy kept there for symmetry with its own registry.
 *
 * Owns its own try/catch and NEVER throws: a failing or slow LLM call must
 * not affect the webhook's response to Meta, which has already completed by
 * the time this listener fires.
 *
 * v1 scope, deliberately: no conversation history (single-turn — just the
 * latest inbound message), no "human agent assigned" gate (no inbox/agents
 * exist yet), no knowledge base — later increments in the approved plan.
 *
 * Note: the generated reply still goes through `client.send()`, which still
 * enforces the existing opt-in guard (GuardEngine) — this does NOT bypass
 * consent just because a reply is AI-generated.
 */
export async function dispatchAiAutoReply(tenantId: string, reply: InboundReply, client: NotifyClient): Promise<void> {
  try {
    if (reply.type !== 'text' || !reply.text?.trim()) return;

    const cmd = reply.text.toLowerCase().trim();
    if (cmd === 'stop' || cmd === 'unsubscribe' || cmd === 'start' || cmd === 'subscribe') return; // owned by existing STOP/START handling

    const config = await getDecryptedAiConfig(tenantId);
    if (!config || !config.autoReplyEnabled) return;

    const thread = await getThreadState(tenantId, reply.from);
    if (thread?.aiAutoreplyDisabled) return;

    const claimed = await claimReplySlot(tenantId, reply.from, config.autoReplyMaxPerConversation);
    if (!claimed) return; // cap reached, or lost a concurrent race — never over-reply

    const { text } = await generateReply({
      provider:     config.provider,
      apiKey:       config.apiKey,
      model:        config.model,
      systemPrompt: config.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT,
      messages:     [{ role: 'user', content: reply.text }],
    });

    if (!text || text.includes(HANDOFF_SENTINEL)) {
      const replyCountSoFar = (thread?.aiReplyCount ?? 0) + 1;
      await markHandoff(tenantId, reply.from, buildHandoffSummary(replyCountSoFar, reply.text));
      return;
    }

    await client.send({ to: reply.from, template: 'text', text });
  } catch (err) {
    console.error(`[ai-auto-reply] dispatch failed for tenant ${tenantId}:`, err);
  }
}
