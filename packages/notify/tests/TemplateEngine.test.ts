import { TemplateEngine } from '../src/core/TemplateEngine';
import { SendOptions } from '../src/types';

describe('TemplateEngine — interactive list messages', () => {
  const engine = new TemplateEngine();

  const baseList: SendOptions['list'] = {
    header: 'Available slots',
    body: 'Pick a time that works for you',
    buttonLabel: 'Choose a slot',
    footer: 'Reply STOP to opt out',
    sections: [
      { title: 'Morning', rows: [{ id: 'slot_9am', title: '9:00 AM', description: 'With Dr. Rao' }] },
    ],
  };

  it('builds a valid Meta list-message payload', () => {
    const payload = engine.build({ to: '919876543210', template: 'interactive_list', list: baseList });

    expect(payload).toEqual({
      messaging_product: 'whatsapp',
      to: '919876543210',
      type: 'interactive',
      interactive: {
        type: 'list',
        header: { type: 'text', text: 'Available slots' },
        body: { text: 'Pick a time that works for you' },
        footer: { text: 'Reply STOP to opt out' },
        action: {
          button: 'Choose a slot',
          sections: [
            { title: 'Morning', rows: [{ id: 'slot_9am', title: '9:00 AM', description: 'With Dr. Rao' }] },
          ],
        },
      },
    });
  });

  it('omits header/footer when not provided', () => {
    const payload = engine.build({
      to: '919876543210',
      template: 'interactive_list',
      list: { body: 'Pick one', buttonLabel: 'Select', sections: baseList!.sections },
    }) as { interactive: Record<string, unknown> };

    expect(payload.interactive.header).toBeUndefined();
    expect(payload.interactive.footer).toBeUndefined();
  });

  it('truncates row title to 24 chars and description to 72', () => {
    const longTitle = 'A'.repeat(40);
    const longDesc  = 'B'.repeat(100);
    const payload = engine.build({
      to: '919876543210',
      template: 'interactive_list',
      list: {
        body: 'Pick one', buttonLabel: 'Select',
        sections: [{ rows: [{ id: 'r1', title: longTitle, description: longDesc }] }],
      },
    }) as { interactive: { action: { sections: Array<{ rows: Array<{ title: string; description: string }> }> } } };

    const row = payload.interactive.action.sections[0].rows[0];
    expect(row.title.length).toBe(24);
    expect(row.description.length).toBe(72);
  });

  it('caps total rows at 10 across multiple sections, dropping the rest', () => {
    const makeRows = (prefix: string, count: number) =>
      Array.from({ length: count }, (_, i) => ({ id: `${prefix}_${i}`, title: `${prefix} ${i}` }));

    const payload = engine.build({
      to: '919876543210',
      template: 'interactive_list',
      list: {
        body: 'Pick one', buttonLabel: 'Select',
        sections: [
          { title: 'Morning', rows: makeRows('am', 6) },
          { title: 'Afternoon', rows: makeRows('pm', 6) },
        ],
      },
    }) as { interactive: { action: { sections: Array<{ rows: unknown[] }> } } };

    const totalRows = payload.interactive.action.sections.reduce((n, s) => n + s.rows.length, 0);
    expect(totalRows).toBe(10);
    expect(payload.interactive.action.sections[0].rows).toHaveLength(6);
    expect(payload.interactive.action.sections[1].rows).toHaveLength(4);
  });

  it('drops a section entirely if the row cap is already exhausted before it', () => {
    const makeRows = (prefix: string, count: number) =>
      Array.from({ length: count }, (_, i) => ({ id: `${prefix}_${i}`, title: `${prefix} ${i}` }));

    const payload = engine.build({
      to: '919876543210',
      template: 'interactive_list',
      list: {
        body: 'Pick one', buttonLabel: 'Select',
        sections: [
          { title: 'Full', rows: makeRows('a', 10) },
          { title: 'Never included', rows: makeRows('b', 2) },
        ],
      },
    }) as { interactive: { action: { sections: Array<{ title?: string }> } } };

    expect(payload.interactive.action.sections).toHaveLength(1);
    expect(payload.interactive.action.sections[0].title).toBe('Full');
  });

  it('falls through to "Template not found" when list is missing or has no sections (unused-path guarantee)', () => {
    expect(() => engine.build({ to: '919876543210', template: 'interactive_list' }))
      .toThrow(/Template "interactive_list" not found/);
    expect(() => engine.build({ to: '919876543210', template: 'interactive_list', list: { body: 'x', buttonLabel: 'y', sections: [] } }))
      .toThrow(/Template "interactive_list" not found/);
  });

  it('leaves every pre-existing template type byte-identical (regression guard)', () => {
    expect(engine.build({ to: '91987', template: 'text', text: 'hi' })).toEqual({
      messaging_product: 'whatsapp', to: '91987', type: 'text', text: { preview_url: false, body: 'hi' },
    });

    expect(engine.build({ to: '91987', template: 'interactive_buttons', text: 'pick one', buttons: ['A', 'B'], meta: { refId: 'x' } }))
      .toEqual({
        messaging_product: 'whatsapp', to: '91987', type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: 'pick one' },
          action: {
            buttons: [
              { type: 'reply', reply: { id: 'btn_0_x', title: 'A' } },
              { type: 'reply', reply: { id: 'btn_1_x', title: 'B' } },
            ],
          },
        },
      });

    expect(engine.build({ to: '91987', template: 'otp', data: { code: '123456' } }))
      .toEqual({
        messaging_product: 'whatsapp', to: '91987', type: 'text',
        text: { body: 'Your verification code is *123456*\n\nValid for 10 minutes.\nDo not share this code with anyone.' },
      });

    expect(() => engine.build({ to: '91987', template: 'nonexistent' }))
      .toThrow(/Template "nonexistent" not found/);
  });
});
