import { NextRequest, NextResponse } from 'next/server';
import { getNotifyClient } from '@/lib/notify';

/** Meta verification handshake — called once during setup */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get('hub.mode');
  const token     = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WA_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

/** Inbound events from Meta (messages, delivery receipts, button replies) */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const body    = JSON.parse(rawBody) as unknown;
  const sig     = req.headers.get('x-hub-signature-256') ?? '';

  const notify  = getNotifyClient();
  await notify.handleWebhookRequest(rawBody, sig, body);

  return new Response('OK', { status: 200 });
}
