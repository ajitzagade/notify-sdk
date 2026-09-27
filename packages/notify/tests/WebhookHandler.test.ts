import { WebhookHandler } from '../src/webhook/WebhookHandler';
import { InboundReply } from '../src/types';

function makeMockClient() {
  return {
    storage: {
      logReply: jest.fn().mockResolvedValue(undefined),
      updateByWaMessageId: jest.fn().mockResolvedValue(undefined),
    },
    eventBus: { emit: jest.fn() },
    config: { onReply: jest.fn() },
    optIn: jest.fn().mockResolvedValue(undefined),
    optOut: jest.fn().mockResolvedValue(undefined),
    http: { post: jest.fn().mockResolvedValue({}) },
  };
}

function listReplyMessage(overrides: Record<string, unknown> = {}) {
  return {
    object: 'whatsapp_business_account',
    entry: [{
      changes: [{
        value: {
          messages: [{
            from: '919876543210',
            id: 'wamid.abc123',
            type: 'interactive',
            interactive: {
              type: 'list_reply',
              list_reply: { id: 'slot_9am', title: '9:00 AM', description: 'With Dr. Rao' },
            },
            ...overrides,
          }],
        },
      }],
    }],
  };
}

describe('WebhookHandler — list_reply parsing', () => {
  it('parses a list-row tap into an InboundReply with type "list" and the row id/title', async () => {
    const client = makeMockClient();
    const handler = new WebhookHandler(client);

    await handler.processVerifiedPayload(listReplyMessage());

    expect(client.storage.logReply).toHaveBeenCalledTimes(1);
    const reply = client.storage.logReply.mock.calls[0][0] as InboundReply;
    expect(reply).toMatchObject({
      from: '919876543210',
      messageId: 'wamid.abc123',
      type: 'list',
      listRowId: 'slot_9am',
      listRowTitle: '9:00 AM',
    });
    expect(reply.buttonId).toBeUndefined();
    expect(reply.buttonTitle).toBeUndefined();
  });

  it('still parses a button_reply as type "button", unaffected by the new branch', async () => {
    const client = makeMockClient();
    const handler = new WebhookHandler(client);

    await handler.processVerifiedPayload({
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ value: { messages: [{
        from: '919876543210', id: 'wamid.btn1', type: 'interactive',
        interactive: { type: 'button_reply', button_reply: { id: 'approve_1', title: 'Approve' } },
      }] } }] }],
    });

    const reply = client.storage.logReply.mock.calls[0][0] as InboundReply;
    expect(reply).toMatchObject({ type: 'button', buttonId: 'approve_1', buttonTitle: 'Approve' });
    expect(reply.listRowId).toBeUndefined();
  });

  it('emits the reply event with list fields present, for outbound-webhook consumers', async () => {
    const client = makeMockClient();
    const handler = new WebhookHandler(client);

    await handler.processVerifiedPayload(listReplyMessage());

    expect(client.eventBus.emit).toHaveBeenCalledWith(
      'reply',
      expect.objectContaining({ type: 'list', listRowId: 'slot_9am', listRowTitle: '9:00 AM' })
    );
  });
});
