import { NextRequest, NextResponse } from 'next/server';
import { withAdminSession } from '@/lib/auth';
import { getTenant } from '@/lib/tenants';
import { listFlowDefinitions, createFlowDefinition, validateTriggerKeyword, type FlowStep } from '@/lib/flowDefinitions';

export const GET = withAdminSession(async (_session, _req: NextRequest, ctx: { params: { id: string } }) => {
  const tenant = await getTenant(ctx.params.id);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const flows = await listFlowDefinitions(tenant.id);
  return NextResponse.json({ flows });
});

export const POST = withAdminSession(async (_session, req: NextRequest, ctx: { params: { id: string } }) => {
  const tenant = await getTenant(ctx.params.id);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const body = (await req.json()) as { triggerKeyword?: string; steps?: FlowStep[]; completionMessage?: string };
  if (!body.triggerKeyword || !body.steps?.length || !body.completionMessage?.trim()) {
    return NextResponse.json({ error: 'triggerKeyword, at least one step, and completionMessage are required' }, { status: 400 });
  }
  const keywordError = validateTriggerKeyword(body.triggerKeyword);
  if (keywordError) return NextResponse.json({ error: keywordError }, { status: 400 });
  for (const step of body.steps) {
    if (!step.question?.trim()) return NextResponse.json({ error: 'Every step needs a question' }, { status: 400 });
    if (step.options && step.options.length > 3) return NextResponse.json({ error: 'WhatsApp allows at most 3 quick-reply options per step' }, { status: 400 });
  }

  try {
    const flow = await createFlowDefinition(tenant.id, {
      triggerKeyword:    body.triggerKeyword,
      steps:             body.steps,
      completionMessage: body.completionMessage.trim(),
    });
    return NextResponse.json({ flow }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('duplicate key')) {
      return NextResponse.json({ error: `A flow already uses the trigger keyword "${body.triggerKeyword.trim().toLowerCase()}"` }, { status: 409 });
    }
    throw err;
  }
});
