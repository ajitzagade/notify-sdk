import type { InboundReply, NotifyClient } from '@orgname/notify';
import { getPool } from '../db';
import { ACTIVE_FLOW, type FlowStep } from './flows';

interface FlowSessionRow {
  current_step: number;
  answers: unknown[];
  status: 'active' | 'completed';
}

async function getSession(tenantId: string, phone: string): Promise<FlowSessionRow | null> {
  const { rows } = await getPool().query(
    `SELECT current_step, answers, status FROM flow_sessions WHERE tenant_id = $1 AND phone = $2`,
    [tenantId, phone]
  );
  return rows[0] ?? null;
}

async function startSession(tenantId: string, phone: string, flowKey: string): Promise<void> {
  await getPool().query(
    `INSERT INTO flow_sessions (tenant_id, phone, flow_key, current_step, answers, status, started_at, completed_at, updated_at)
     VALUES ($1, $2, $3, 0, '[]', 'active', NOW(), NULL, NOW())
     ON CONFLICT (tenant_id, phone) DO UPDATE SET
       flow_key = EXCLUDED.flow_key, current_step = 0, answers = '[]', status = 'active',
       started_at = NOW(), completed_at = NULL, updated_at = NOW()`,
    [tenantId, phone, flowKey]
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
 * Fixed, platform-wide Q&A automation — a customer texts the trigger keyword
 * to start, then each subsequent reply (button tap or free text) is recorded
 * verbatim as that step's answer and advances to the next question. No
 * validation against the offered options — keeping this simple was a
 * deliberate choice, not an oversight; add validation if a flow later needs
 * to reject off-menu answers.
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
      if (text.toLowerCase() !== ACTIVE_FLOW.triggerKeyword) return false;
      await startSession(tenantId, reply.from, ACTIVE_FLOW.key);
      await sendStep(client, reply.from, ACTIVE_FLOW.steps[0]);
      return true;
    }

    const answers = [...session.answers, text];
    const nextStep = session.current_step + 1;

    if (nextStep >= ACTIVE_FLOW.steps.length) {
      await recordAnswerAndAdvance(tenantId, reply.from, answers, nextStep, true);
      await client.send({ to: reply.from, template: 'text', text: ACTIVE_FLOW.completionMessage });
    } else {
      await recordAnswerAndAdvance(tenantId, reply.from, answers, nextStep, false);
      await sendStep(client, reply.from, ACTIVE_FLOW.steps[nextStep]);
    }
    return true;
  } catch (err) {
    console.error(`[automation-flow] dispatch failed for tenant ${tenantId}:`, err);
    return false;
  }
}
