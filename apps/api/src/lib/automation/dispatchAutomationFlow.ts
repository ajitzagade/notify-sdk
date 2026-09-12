import type { InboundReply, NotifyClient } from '@orgname/notify';
import { getPool } from '../db';
import type { FlowStep } from './flows';

interface FlowDefinitionRow {
  id: string;
  steps: FlowStep[];
  completion_message: string;
}

interface FlowSessionRow {
  flow_definition_id: string | null;
  current_step: number;
  answers: unknown[];
  status: 'active' | 'completed';
}

async function findMatchingFlow(tenantId: string, keyword: string): Promise<FlowDefinitionRow | null> {
  const { rows } = await getPool().query(
    `SELECT id, steps, completion_message FROM flow_definitions
      WHERE tenant_id = $1 AND is_active = true AND trigger_keyword = $2
      LIMIT 1`,
    [tenantId, keyword.toLowerCase()]
  );
  return rows[0] ?? null;
}

async function getSession(tenantId: string, phone: string): Promise<FlowSessionRow | null> {
  const { rows } = await getPool().query(
    `SELECT flow_definition_id, current_step, answers, status FROM flow_sessions WHERE tenant_id = $1 AND phone = $2`,
    [tenantId, phone]
  );
  return rows[0] ?? null;
}

async function getFlowById(id: string): Promise<FlowDefinitionRow | null> {
  const { rows } = await getPool().query(
    `SELECT id, steps, completion_message FROM flow_definitions WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

async function startSession(tenantId: string, phone: string, flowDefinitionId: string, triggerKeyword: string): Promise<void> {
  await getPool().query(
    `INSERT INTO flow_sessions (tenant_id, phone, flow_key, flow_definition_id, current_step, answers, status, started_at, completed_at, updated_at)
     VALUES ($1, $2, $3, $4, 0, '[]', 'active', NOW(), NULL, NOW())
     ON CONFLICT (tenant_id, phone) DO UPDATE SET
       flow_key = EXCLUDED.flow_key, flow_definition_id = EXCLUDED.flow_definition_id,
       current_step = 0, answers = '[]', status = 'active',
       started_at = NOW(), completed_at = NULL, updated_at = NOW()`,
    [tenantId, phone, triggerKeyword, flowDefinitionId]
  );
}

async function recordAnswerAndAdvance(
  tenantId: string, phone: string, answers: unknown[], nextStep: number, completed: boolean
): Promise<void> {
  await getPool().query(
    `UPDATE flow_sessions
        SET answers = $3, current_step = $4, status = $5,
            completed_at = CASE WHEN $5::varchar = 'completed' THEN NOW() ELSE completed_at END,
            updated_at = NOW()
      WHERE tenant_id = $1 AND phone = $2`,
    [tenantId, phone, JSON.stringify(answers), nextStep, completed ? 'completed' : 'active']
  );
}

/** Quick-reply buttons for a step with options, plain text otherwise — see
 * TemplateEngine's 'interactive_buttons'/'text' built-ins (no custom
 * registerTemplate needed for either). */
async function sendStep(client: NotifyClient, to: string, step: FlowStep): Promise<void> {
  if (step.options?.length) {
    await client.send({ to, template: 'interactive_buttons', text: step.question, buttons: step.options });
  } else {
    await client.send({ to, template: 'text', text: step.question });
  }
}

const CONSENT_KEYWORDS = new Set(['stop', 'unsubscribe', 'start', 'subscribe']);

/**
 * Per-tenant configurable Q&A automation (generalized from the original
 * fixed "book" flow — see apps/admin/src/lib/flowDefinitions.ts for the
 * admin-console editor this data comes from). A customer texts a tenant's
 * own trigger keyword to start; each subsequent reply is recorded verbatim
 * as that step's answer and advances to the next question. No validation
 * against the offered options — a deliberate simplicity choice.
 *
 * Registered as an eventBus 'reply' listener in tenantRegistry.ts, ahead of
 * dispatchAiAutoReply — returns true when it has consumed the message so the
 * caller skips the AI responder for that message. Owns its own try/catch and
 * never throws, same contract as dispatchAiAutoReply; on error it returns
 * false (fails open to the AI responder) rather than swallowing the message.
 */
export async function dispatchAutomationFlow(
  tenantId: string, reply: InboundReply, client: NotifyClient
): Promise<boolean> {
  try {
    const text = (reply.type === 'text' ? reply.text : reply.buttonTitle)?.trim();
    if (!text) return false;
    if (CONSENT_KEYWORDS.has(text.toLowerCase())) return false; // owned by existing STOP/START handling

    const session = await getSession(tenantId, reply.from);

    if (!session || session.status !== 'active') {
      const flow = await findMatchingFlow(tenantId, text);
      if (!flow) return false;
      await startSession(tenantId, reply.from, flow.id, text.toLowerCase());
      await sendStep(client, reply.from, flow.steps[0]);
      return true;
    }

    if (!session.flow_definition_id) return false; // orphaned session (flow deleted mid-conversation) — fail open
    const flow = await getFlowById(session.flow_definition_id);
    if (!flow) return false; // flow deleted/renamed since the session started

    const answers = [...session.answers, text];
    const nextStep = session.current_step + 1;

    if (nextStep >= flow.steps.length) {
      await recordAnswerAndAdvance(tenantId, reply.from, answers, nextStep, true);
      await client.send({ to: reply.from, template: 'text', text: flow.completion_message });
    } else {
      await recordAnswerAndAdvance(tenantId, reply.from, answers, nextStep, false);
      await sendStep(client, reply.from, flow.steps[nextStep]);
    }
    return true;
  } catch (err) {
    console.error(`[automation-flow] dispatch failed for tenant ${tenantId}:`, err);
    return false;
  }
}
