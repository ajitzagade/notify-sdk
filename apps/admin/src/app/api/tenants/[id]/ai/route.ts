import { NextRequest, NextResponse } from 'next/server';
import { withAdminSession } from '@/lib/auth';
import { getTenant } from '@/lib/tenants';
import { getAiConfigStatus, saveAiConfig } from '@/lib/aiConfig';
import { recordAuditEvent } from '@/lib/auditLog';
import type { AiProvider } from '@/lib/ai/generate';

export const GET = withAdminSession(async (_session, _req: NextRequest, ctx: { params: { id: string } }) => {
  const tenant = await getTenant(ctx.params.id);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const status = await getAiConfigStatus(tenant.id);
  return NextResponse.json({ status });
});

export const PUT = withAdminSession(async (session, req: NextRequest, ctx: { params: { id: string } }) => {
  const tenant = await getTenant(ctx.params.id);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const body = (await req.json()) as {
    provider?: AiProvider;
    model?: string;
    apiKey?: string;
    systemPrompt?: string;
    autoReplyEnabled?: boolean;
    autoReplyMaxPerConversation?: number;
  };

  if (!body.provider || !body.model) {
    return NextResponse.json({ error: 'provider and model are required' }, { status: 400 });
  }

  try {
    await saveAiConfig({
      tenantId:                    tenant.id,
      provider:                    body.provider,
      model:                       body.model,
      apiKey:                      body.apiKey || undefined,
      systemPrompt:                body.systemPrompt?.trim() || null,
      autoReplyEnabled:            Boolean(body.autoReplyEnabled),
      autoReplyMaxPerConversation: body.autoReplyMaxPerConversation ?? 3,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }

  await recordAuditEvent({
    tenantId:    tenant.id,
    adminUserId: session.adminUserId,
    action:      'tenant.ai_config.updated',
    details:     { provider: body.provider, model: body.model, autoReplyEnabled: Boolean(body.autoReplyEnabled) },
  });

  return NextResponse.json({ ok: true, status: await getAiConfigStatus(tenant.id) });
});
