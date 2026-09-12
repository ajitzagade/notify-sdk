import { NextRequest, NextResponse } from 'next/server';
import { withAdminSession } from '@/lib/auth';
import { getTenant } from '@/lib/tenants';
import { updateFlowDefinition, deleteFlowDefinition, validateTriggerKeyword, type FlowStep } from '@/lib/flowDefinitions';

export const PATCH = withAdminSession(
  async (_session, req: NextRequest, ctx: { params: { id: string; flowId: string } }) => {
    const tenant = await getTenant(ctx.params.id);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const body = (await req.json()) as {
      triggerKeyword?: string; steps?: FlowStep[]; completionMessage?: string; isActive?: boolean;
    };
    if (body.triggerKeyword !== undefined) {
      const keywordError = validateTriggerKeyword(body.triggerKeyword);
      if (keywordError) return NextResponse.json({ error: keywordError }, { status: 400 });
    }

    try {
      const flow = await updateFlowDefinition(tenant.id, ctx.params.flowId, body);
      if (!flow) return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
      return NextResponse.json({ flow });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('duplicate key')) {
        return NextResponse.json({ error: 'Another flow already uses that trigger keyword' }, { status: 409 });
      }
      throw err;
    }
  }
);

export const DELETE = withAdminSession(
  async (_session, _req: NextRequest, ctx: { params: { id: string; flowId: string } }) => {
    const tenant = await getTenant(ctx.params.id);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    await deleteFlowDefinition(tenant.id, ctx.params.flowId);
    return NextResponse.json({ ok: true });
  }
);
