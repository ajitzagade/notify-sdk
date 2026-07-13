import { NextRequest, NextResponse } from 'next/server';
import { withAdminSession } from '@/lib/auth';
import { testProviderKey, type AiProvider } from '@/lib/ai/generate';

export const POST = withAdminSession(async (_session, req: NextRequest) => {
  const body = (await req.json()) as { provider?: AiProvider; apiKey?: string; model?: string };
  if (!body.provider || !body.apiKey || !body.model) {
    return NextResponse.json({ error: 'provider, apiKey, and model are required' }, { status: 400 });
  }

  const result = await testProviderKey(body.provider, body.apiKey, body.model);
  return NextResponse.json(result);
});
