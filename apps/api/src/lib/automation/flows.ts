// Flow shape shared with the admin app's flow_definitions CRUD
// (apps/admin/src/lib/flowDefinitions.ts) — the actual flow content now
// lives in that table, tenant-configurable from the admin console, not
// hardcoded here. This file only holds the type both sides parse the same
// JSONB `steps` column into.

export interface FlowStep {
  question: string;
  /** Up to 3 labels — sent as WhatsApp quick-reply buttons. Omit for free text. */
  options?: string[];
}
