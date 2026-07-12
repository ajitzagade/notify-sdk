import { NextRequest, NextResponse } from 'next/server';
import { getNotifyClient } from '@/lib/notify';

export async function POST(
  req: NextRequest,
  { params }: { params: { action: string } }
) {
  const body   = await req.json() as Record<string, unknown>;
  const notify = getNotifyClient();

  try {
    switch (params.action) {

      case 'send': {
        const event = await notify.send({
          to:         body.to as string,
          template:   body.template as string,
          data:       body.data as Record<string, unknown>,
          text:       body.text as string | undefined,
          buttons:    body.buttons as string[] | undefined,
          scheduleAt: body.scheduleAt ? new Date(body.scheduleAt as string) : undefined,
          tags:       body.tags as string[] | undefined,
          meta:       body.meta as Record<string, unknown> | undefined,
        });
        return NextResponse.json(event);
      }

      case 'send-bulk': {
        if (body.listName) {
          const result = await notify.sendToList(body.listName as string, {
            template: body.template as string,
            data:     body.data as Record<string, unknown>,
            text:     body.text as string | undefined,
            buttons:  body.buttons as string[] | undefined,
          });
          return NextResponse.json(result);
        }
        const result = await notify.sendBulk({
          recipients: body.recipients as string[],
          template:   body.template as string,
          data:       body.data as Record<string, unknown>,
          text:       body.text as string | undefined,
          buttons:    body.buttons as string[] | undefined,
          batchSize:  (body.batchSize as number | undefined) ?? 50,
        });
        return NextResponse.json(result);
      }

      case 'opt-in': {
        await notify.optIn(body.phone as string);
        return NextResponse.json({ success: true });
      }

      case 'opt-out': {
        await notify.optOut(body.phone as string);
        return NextResponse.json({ success: true });
      }

      case 'mute': {
        await notify.mute(body.phone as string, body.durationMs as number);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${params.action}` }, { status: 400 });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
