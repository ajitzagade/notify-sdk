// Client-safe: imported by 'use client' components at runtime, so this module
// must never import anything that transitively pulls in @orgname/notify or pg
// (see the child_process gotcha in CLAUDE.md).

export const TENANT_CATEGORIES = [
  { value: 'healthcare', label: 'Healthcare — clinic, hospital, lab' },
  { value: 'retail',     label: 'Retail — shop, e-commerce' },
  { value: 'restaurant', label: 'Restaurant & food' },
  { value: 'services',   label: 'Services — salon, repair, agency' },
  { value: 'education',  label: 'Education & training' },
  { value: 'other',      label: 'Other' },
] as const;

export type TenantCategory = (typeof TENANT_CATEGORIES)[number]['value'];

export const TENANT_CATEGORY_ITEMS: Record<string, string> = Object.fromEntries(
  TENANT_CATEGORIES.map((c) => [c.value, c.label])
);
