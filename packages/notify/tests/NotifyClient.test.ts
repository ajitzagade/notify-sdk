import { NotifyClient }        from '../src/client/NotifyClient';
import { InMemoryAdapter }      from '../src/adapters/storage/InMemoryAdapter';
import { InlineQueueAdapter }   from '../src/adapters/queue/InlineQueueAdapter';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeClient(overrides?: Partial<ConstructorParameters<typeof NotifyClient>[0]>) {
  const storage = new InMemoryAdapter();
  const client  = new NotifyClient({
    accessToken:   'test-token',
    phoneNumberId: 'test-phone-id',
    verifyToken:   'test-verify',
    storage,
    queue: new InlineQueueAdapter(),
    ...overrides,
  });

  const httpSpy = jest
    .spyOn(client['http'], 'post')
    .mockResolvedValue({ messages: [{ id: 'wamid.test123' }] });

  return { client, storage, httpSpy };
}

async function optIn(storage: InMemoryAdapter, phone: string) {
  await storage.setPreference(phone, { phone, optedIn: true });
}

// ── Guard engine ──────────────────────────────────────────────────────────────

describe('Guard — blocks when not opted in', () => {
  it('returns failed with no_preference_record', async () => {
    const { client } = makeClient();
    const event = await client.send({ to: '919876543210', template: 'text', text: 'Hi' });
    expect(event.status).toBe('failed');
    expect((event.meta as Record<string,unknown>)?.blockedReason).toBe('no_preference_record');
  });

  it('returns failed when opted_in = false', async () => {
    const { client, storage } = makeClient();
    await storage.setPreference('919876543210', { phone: '919876543210', optedIn: false });
    const event = await client.send({ to: '919876543210', template: 'text', text: 'Hi' });
    expect(event.status).toBe('failed');
    expect((event.meta as Record<string,unknown>)?.blockedReason).toBe('not_opted_in');
  });

  it('respects mute', async () => {
    const { client, storage } = makeClient();
    await storage.setPreference('919876543210', {
      phone: '919876543210', optedIn: true,
      mutedUntil: new Date(Date.now() + 60_000),
    });
    const event = await client.send({ to: '919876543210', template: 'text', text: 'Hi' });
    expect((event.meta as Record<string,unknown>)?.blockedReason).toBe('muted');
  });

  it('respects quiet hours', async () => {
    const { client, storage } = makeClient();
    await storage.setPreference('919876543210', {
      phone: '919876543210', optedIn: true,
      quietHours: { start: 0, end: 23 }, // always quiet for test
    });
    const event = await client.send({ to: '919876543210', template: 'text', text: 'Hi' });
    expect((event.meta as Record<string,unknown>)?.blockedReason).toBe('quiet_hours');
  });
});

// ── Single send ───────────────────────────────────────────────────────────────

describe('Single send', () => {
  it('sends a text message', async () => {
    const { client, storage, httpSpy } = makeClient();
    await optIn(storage, '919876543210');

    const event = await client.send({ to: '919876543210', template: 'text', text: 'Hello world' });

    expect(httpSpy).toHaveBeenCalledWith('/messages', expect.objectContaining({ type: 'text' }));
    expect(event.status).toBe('sent');
    expect(event.waMessageId).toBe('wamid.test123');
  });

  it('sends a built-in OTP template', async () => {
    const { client, storage, httpSpy } = makeClient();
    await optIn(storage, '919876543210');

    await client.send({
      to: '919876543210', template: 'otp',
      data: { code: '847291', expiresIn: '5 minutes' },
    });

    expect(httpSpy).toHaveBeenCalledWith('/messages', expect.objectContaining({ type: 'text' }));
  });

  it('sends task_assigned template with interactive buttons', async () => {
    const { client, storage, httpSpy } = makeClient();
    await optIn(storage, '919876543210');

    await client.send({
      to: '919876543210', template: 'task_assigned',
      data: { title: 'Fix bug #123', priority: 'high', taskId: 't1', assignedBy: 'PM', dueDate: 'Tomorrow' },
    });

    const payload = httpSpy.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.type).toBe('interactive');
  });

  it('stores event in log after send', async () => {
    const { client, storage } = makeClient();
    await optIn(storage, '919876543210');

    const event = await client.send({ to: '919876543210', template: 'text', text: 'Test' });
    const logged = await storage.getEvent(event.id);

    expect(logged).not.toBeNull();
    expect(logged?.status).toBe('sent');
    expect(logged?.waMessageId).toBe('wamid.test123');
  });

  it('high priority bypasses queue and sends immediately', async () => {
    const { client, storage, httpSpy } = makeClient();
    await optIn(storage, '919876543210');

    await client.send({
      to: '919876543210', template: 'text', text: 'Urgent!', priority: 'high',
    });

    expect(httpSpy).toHaveBeenCalledTimes(1);
  });

  it('tags are stored in the log', async () => {
    const { client, storage } = makeClient();
    await optIn(storage, '919876543210');

    const event = await client.send({
      to: '919876543210', template: 'text', text: 'Tagged', tags: ['test', 'demo'],
    });

    const logged = await storage.getEvent(event.id);
    expect(logged?.tags).toEqual(['test', 'demo']);
  });
});

// ── Built-in templates ────────────────────────────────────────────────────────

describe('Built-in templates', () => {
  it.each([
    ['alert',            { body: 'Test', buttons: ['OK'], refId: '1' }],
    ['reminder',         { title: 'Meeting', body: 'At 3pm', dueDate: 'Today' }],
    ['approval_request', { title: 'Leave', requestedBy: 'Rahul', refId: 'l1' }],
    ['status_update',    { entity: 'Task', from: 'todo', to: 'done' }],
    ['task_due_soon',    { title: 'Fix bug', priority: 'high', taskId: 't1', dueDate: 'Today', status: 'todo' }],
  ])('renders %s without throwing', async (templateName, data) => {
    const { client, storage } = makeClient();
    await optIn(storage, '919876543210');

    const event = await client.send({ to: '919876543210', template: templateName, data });
    expect(event.status).toBe('sent');
  });
});

// ── Custom templates ──────────────────────────────────────────────────────────

describe('Custom templates', () => {
  it('registers and uses a custom template', async () => {
    const { client, storage, httpSpy } = makeClient();
    await optIn(storage, '919876543210');

    client.registerTemplate('my_template', (data) => ({
      type: 'text',
      text: { body: `Hello ${data.name}` },
    }));

    await client.send({ to: '919876543210', template: 'my_template', data: { name: 'Rahul' } });

    const payload = httpSpy.mock.calls[0][1] as Record<string, unknown>;
    const text    = (payload as { text: { body: string } }).text;
    expect(text.body).toBe('Hello Rahul');
  });

  it('throws when template not found', async () => {
    const { client, storage } = makeClient();
    await optIn(storage, '919876543210');

    await expect(
      client.send({ to: '919876543210', template: 'nonexistent' })
    ).rejects.toThrow('Template "nonexistent" not found');
  });
});

// ── Bulk send ─────────────────────────────────────────────────────────────────

describe('Bulk send', () => {
  it('sends to all recipients', async () => {
    const { client, storage, httpSpy } = makeClient();
    const phones = ['919876543210', '919123456789', '918765432100'];
    for (const p of phones) await optIn(storage, p);

    const result = await client.sendBulk({
      recipients: phones,
      template:   'text',
      text:       'Bulk test',
    });

    expect(httpSpy).toHaveBeenCalledTimes(phones.length);
    expect(result.sent).toBe(phones.length);
    expect(result.total).toBe(phones.length);
  });

  it('deduplicates recipients', async () => {
    const { client, storage, httpSpy } = makeClient();
    await optIn(storage, '919876543210');

    const result = await client.sendBulk({
      recipients: ['919876543210', '919876543210', '919876543210'],
      template:   'text',
      text:       'Dedupe test',
    });

    expect(httpSpy).toHaveBeenCalledTimes(1);
    expect(result.total).toBe(1);
  });

  it('counts skipped for non-opted-in numbers', async () => {
    const { client, storage } = makeClient();
    await optIn(storage, '919876543210');
    // '919123456789' is NOT opted in

    const result = await client.sendBulk({
      recipients: ['919876543210', '919123456789'],
      template:   'text',
      text:       'Skip test',
    });

    expect(result.sent).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it('calls onProgress callback', async () => {
    const { client, storage } = makeClient();
    const phones = ['919876543210', '919123456789'];
    for (const p of phones) await optIn(storage, p);

    const progress: number[] = [];
    await client.sendBulk({
      recipients: phones,
      template:   'text',
      text:       'Progress test',
      batchSize:  1,
      onProgress: (p) => progress.push(p.percent),
    });

    expect(progress.length).toBeGreaterThan(0);
    expect(progress[progress.length - 1]).toBe(100);
  });

  it('sends to a named broadcast list', async () => {
    const { client, storage, httpSpy } = makeClient();
    const phones = ['919876543210', '919123456789'];
    for (const p of phones) await optIn(storage, p);

    client.broadcastLists.define({ name: 'test-team', phones });

    const result = await client.sendToList('test-team', {
      template: 'text',
      text:     'List send test',
    });

    expect(httpSpy).toHaveBeenCalledTimes(phones.length);
    expect(result.sent).toBe(phones.length);
  });
});

// ── Opt-in / opt-out ─────────────────────────────────────────────────────────

describe('Opt-in / opt-out', () => {
  it('optIn sets opted_in = true and sends confirmation', async () => {
    const { client, storage, httpSpy } = makeClient();

    await client.optIn('919876543210');

    const pref = await storage.getPreference('919876543210');
    expect(pref?.optedIn).toBe(true);
    expect(httpSpy).toHaveBeenCalledWith(
      '/messages',
      expect.objectContaining({ to: '919876543210' })
    );
  });

  it('optOut sets opted_in = false', async () => {
    const { client, storage } = makeClient();
    await optIn(storage, '919876543210');

    await client.optOut('919876543210');

    const pref = await storage.getPreference('919876543210');
    expect(pref?.optedIn).toBe(false);
  });

  it('mute blocks messages until unmuted', async () => {
    const { client, storage } = makeClient();
    await optIn(storage, '919876543210');

    await client.mute('919876543210', 60_000);
    const event = await client.send({ to: '919876543210', template: 'text', text: 'Muted?' });
    expect((event.meta as Record<string,unknown>)?.blockedReason).toBe('muted');

    await client.unmute('919876543210');
    const event2 = await client.send({ to: '919876543210', template: 'text', text: 'Unmuted!' });
    expect(event2.status).toBe('sent');
  });
});

// ── Event callbacks ───────────────────────────────────────────────────────────

describe('Lifecycle callbacks', () => {
  it('calls onSent after successful send', async () => {
    const onSent = jest.fn();
    const { client, storage } = makeClient({ onSent });
    await optIn(storage, '919876543210');

    await client.send({ to: '919876543210', template: 'text', text: 'Callback test' });

    expect(onSent).toHaveBeenCalledWith(expect.objectContaining({ status: 'sent' }));
  });

  it('calls onFailed when API throws', async () => {
    const onFailed = jest.fn();
    const { client, storage, httpSpy } = makeClient({ onFailed });
    await optIn(storage, '919876543210');
    httpSpy.mockRejectedValueOnce(new Error('API error'));

    await expect(
      client.send({ to: '919876543210', template: 'text', text: 'Fail test' })
    ).rejects.toThrow('API error');

    expect(onFailed).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' }),
      expect.any(Error)
    );
  });
});

// ── Notification log ─────────────────────────────────────────────────────────

describe('Notification log', () => {
  it('getRecentEvents returns sent events', async () => {
    const { client, storage } = makeClient();
    await optIn(storage, '919876543210');

    await client.send({ to: '919876543210', template: 'text', text: 'Log test' });

    const events = await client.getRecentEvents(10);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].status).toBe('sent');
  });
});
