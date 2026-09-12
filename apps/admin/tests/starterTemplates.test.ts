import {
  STARTER_TEMPLATES,
  STARTER_GROUPS,
  getStarterTemplate,
  defaultGroupForCategory,
  renderStarterPreview,
  starterToMetaComponents,
} from '@/lib/starterTemplates';

describe('starter template catalog', () => {
  it('every template has matching param labels and examples', () => {
    for (const t of STARTER_TEMPLATES) {
      expect(t.paramLabels.length).toBe(t.paramExamples.length);
    }
  });

  it('every {{n}} variable in the body has an example value, with no gaps', () => {
    for (const t of STARTER_TEMPLATES) {
      const nums = [...t.bodyText.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
      const max = Math.max(0, ...nums);
      expect(max).toBe(t.paramExamples.length);
      // Meta rejects non-sequential variables ({{1}}, {{3}} with no {{2}})
      for (let i = 1; i <= max; i++) expect(nums).toContain(i);
    }
  });

  it('template keys are valid Meta template names (lowercase snake_case) and unique', () => {
    const keys = STARTER_TEMPLATES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  it('every template belongs to a declared group', () => {
    const groups = new Set(STARTER_GROUPS.map((g) => g.value));
    for (const t of STARTER_TEMPLATES) expect(groups.has(t.group)).toBe(true);
  });

  it('marketing templates carry opt-out language', () => {
    for (const t of STARTER_TEMPLATES.filter((t) => t.metaCategory === 'MARKETING')) {
      expect(t.bodyText).toMatch(/STOP/);
    }
  });

  it('getStarterTemplate finds by key and returns undefined for unknown keys', () => {
    expect(getStarterTemplate('appointment_reminder')?.label).toBe('Appointment reminder');
    expect(getStarterTemplate('nope')).toBeUndefined();
  });

  it('defaultGroupForCategory maps business categories to relevant groups', () => {
    expect(defaultGroupForCategory('healthcare')).toBe('appointments');
    expect(defaultGroupForCategory('retail')).toBe('orders');
    expect(defaultGroupForCategory('education')).toBe('alerts');
    expect(defaultGroupForCategory(null)).toBe('appointments');
    expect(defaultGroupForCategory('something-unknown')).toBe('appointments');
  });

  it('renderStarterPreview substitutes every variable with its example', () => {
    const t = getStarterTemplate('appointment_reminder')!;
    const rendered = renderStarterPreview(t);
    expect(rendered).not.toMatch(/\{\{\d+\}\}/);
    for (const example of t.paramExamples) expect(rendered).toContain(example);
  });

  it('starterToMetaComponents builds a BODY with example values, and BUTTONS only when present', () => {
    const withButtons = starterToMetaComponents(getStarterTemplate('appointment_reminder')!) as Array<
      Record<string, unknown>
    >;
    expect(withButtons[0]).toMatchObject({
      type: 'BODY',
      example: { body_text: [getStarterTemplate('appointment_reminder')!.paramExamples] },
    });
    expect(withButtons[1]).toMatchObject({ type: 'BUTTONS' });

    const withoutButtons = starterToMetaComponents(getStarterTemplate('order_confirmation')!) as Array<
      Record<string, unknown>
    >;
    expect(withoutButtons).toHaveLength(1);
    expect(withoutButtons[0]).toMatchObject({ type: 'BODY' });
  });
});
