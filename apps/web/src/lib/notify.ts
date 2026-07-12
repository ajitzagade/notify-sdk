import { NotifyClient, InlineQueueAdapter, InMemoryAdapter } from '@orgname/notify';

let client: NotifyClient | null = null;

export function getNotifyClient(): NotifyClient {
  if (client) return client;

  client = new NotifyClient({
    accessToken:   process.env.WA_ACCESS_TOKEN   ?? '',
    phoneNumberId: process.env.WA_PHONE_NUMBER_ID ?? '',
    verifyToken:   process.env.WA_VERIFY_TOKEN   ?? 'my_verify_token_123',
    appSecret:     process.env.WA_APP_SECRET,

    queue:   new InlineQueueAdapter(),
    storage: new InMemoryAdapter(),

    defaults: {
      timezone:   'Asia/Kolkata',
      quietHours: { start: 22, end: 8 },
    },

    onSent:   (e)      => console.log('[Notify] Sent:', e.template, '→', e.to),
    onFailed: (e, err) => console.error('[Notify] Failed:', e.to, err.message),
    onReply:  (reply)  => {
      console.log('[Notify] Reply from', reply.from, ':', reply.buttonTitle ?? reply.text);
    },
  });

  // Define broadcast lists
  client.broadcastLists
    .define({ name: 'engineering', phones: [] })
    .define({ name: 'all-hands',   phones: [] });

  // Register a custom deploy template
  client.registerTemplate('deploy_alert', (data) => ({
    type: 'interactive',
    interactive: {
      type: 'button',
      header: { type: 'text', text: data.status === 'success' ? 'Deploy successful' : 'Deploy failed' },
      body: {
        text:
          `*${data.service}* v${data.version}\n` +
          `Env: ${data.env} | By: ${data.triggeredBy}`,
      },
      action: {
        buttons: [
          { type: 'reply', reply: { id: `view_${data.deployId}`, title: 'View logs' } },
          { type: 'reply', reply: { id: `rb_${data.deployId}`,   title: 'Rollback'  } },
        ],
      },
    },
  }));

  return client;
}
