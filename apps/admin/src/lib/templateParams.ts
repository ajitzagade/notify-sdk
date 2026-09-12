import type { TemplateRecord } from './templates';

export function bodyText(template: TemplateRecord): string {
  return template.components.find((c) => c.type === 'BODY')?.text ?? '';
}

export function placeholderCount(text: string): number {
  const matches = [...text.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  return matches.length ? Math.max(...matches) : 0;
}
