// Client-safe: imported by 'use client' components at runtime — no heavy imports
// (see the child_process gotcha in CLAUDE.md).
//
// The starter template library (Phase 1 of docs/whatsapp-platform-roadmap.md):
// pre-drafted HSM templates a tenant submits to Meta with one click instead of
// authoring copy in WhatsApp Manager. Template approval — not credential setup —
// is the long pole between onboarding and a first real send, so everything here
// is written to pass Meta review: numbered {{n}} variables with example values,
// opt-out language on marketing templates, no shortened URLs.

import type { TenantCategory } from './categories';

export type StarterGroup = 'appointments' | 'orders' | 'promotions' | 'alerts' | 'followups';

export const STARTER_GROUPS: { value: StarterGroup; label: string }[] = [
  { value: 'appointments', label: 'Appointments' },
  { value: 'orders',       label: 'Orders & delivery' },
  { value: 'promotions',   label: 'Promotions' },
  { value: 'alerts',       label: 'Alerts & reports' },
  { value: 'followups',    label: 'Follow-ups' },
];

export interface StarterTemplate {
  /** Catalog key AND the template name registered on Meta (lowercase snake_case). */
  key: string;
  label: string;
  group: StarterGroup;
  /** Meta's template category — determines pricing and review strictness. */
  metaCategory: 'UTILITY' | 'MARKETING';
  language: string;
  /** Body text with numbered {{1}}, {{2}}… variables, Meta's required format. */
  bodyText: string;
  /** One human label per variable, in order — shown under the preview. */
  paramLabels: string[];
  /** Example values per variable, in order — required by Meta's review, used in the preview. */
  paramExamples: string[];
  buttons?: { type: 'QUICK_REPLY'; text: string }[];
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    key: 'appointment_reminder',
    label: 'Appointment reminder',
    group: 'appointments',
    metaCategory: 'UTILITY',
    language: 'en',
    bodyText:
      'Hi {{1}} 👋 This is a reminder of your appointment with {{2}} on {{3}} at {{4}}. See you then!',
    paramLabels: ['Customer name', 'Business name', 'Date', 'Time'],
    paramExamples: ['Asha', 'Sunrise Dental Clinic', 'Monday 15 Sep', '4:30 PM'],
    buttons: [
      { type: 'QUICK_REPLY', text: 'Confirm' },
      { type: 'QUICK_REPLY', text: 'Reschedule' },
    ],
  },
  {
    key: 'appointment_confirmed',
    label: 'Booking confirmation',
    group: 'appointments',
    metaCategory: 'UTILITY',
    language: 'en',
    bodyText:
      '✅ {{1}}, your appointment with {{2}} is confirmed for {{3}} at {{4}}. Reply to this message if you need to make changes.',
    paramLabels: ['Customer name', 'Business name', 'Date', 'Time'],
    paramExamples: ['Asha', 'Sunrise Dental Clinic', 'Monday 15 Sep', '4:30 PM'],
  },
  {
    key: 'order_confirmation',
    label: 'Order confirmation',
    group: 'orders',
    metaCategory: 'UTILITY',
    language: 'en',
    bodyText:
      'Thanks for your order, {{1}}! 🛍️ Order {{2}} for {{3}} has been received and is being prepared. We’ll message you when it ships.',
    paramLabels: ['Customer name', 'Order number', 'Amount'],
    paramExamples: ['Asha', '#1042', '₹1,499'],
  },
  {
    key: 'delivery_update',
    label: 'Delivery update',
    group: 'orders',
    metaCategory: 'UTILITY',
    language: 'en',
    bodyText:
      '📦 Update on order {{1}}: {{2}}. Expected by {{3}}.',
    paramLabels: ['Order number', 'Status', 'Expected date'],
    paramExamples: ['#1042', 'Out for delivery', 'today, 6 PM'],
    buttons: [{ type: 'QUICK_REPLY', text: 'Track order' }],
  },
  {
    key: 'special_offer',
    label: 'Special offer',
    group: 'promotions',
    metaCategory: 'MARKETING',
    language: 'en',
    bodyText:
      'Hi {{1}}! 🎉 {{2}} has a special offer for you: {{3}}. Valid until {{4}}. Reply STOP to unsubscribe.',
    paramLabels: ['Customer name', 'Business name', 'Offer', 'Valid until'],
    paramExamples: ['Asha', 'Corner Bakery', '20% off all birthday cakes', '30 Sep'],
    buttons: [{ type: 'QUICK_REPLY', text: 'Tell me more' }],
  },
  {
    key: 'report_ready',
    label: 'Report ready',
    group: 'alerts',
    metaCategory: 'UTILITY',
    language: 'en',
    bodyText:
      'Hello {{1}}, your {{2}} from {{3}} is ready. Reply to this message and we’ll send it right over.',
    paramLabels: ['Customer name', 'Document', 'Business name'],
    paramExamples: ['Asha', 'lab report', 'Sunrise Dental Clinic'],
    buttons: [{ type: 'QUICK_REPLY', text: 'Send it here' }],
  },
  {
    key: 'payment_reminder',
    label: 'Payment reminder',
    group: 'alerts',
    metaCategory: 'UTILITY',
    language: 'en',
    bodyText:
      'Hi {{1}}, a gentle reminder that {{2}} is due to {{3}} by {{4}}. Reply here if you have any questions.',
    paramLabels: ['Customer name', 'Amount', 'Business name', 'Due date'],
    paramExamples: ['Asha', '₹2,000', 'Sunrise Dental Clinic', 'Friday 19 Sep'],
  },
  {
    key: 'feedback_request',
    label: 'Feedback request',
    group: 'followups',
    metaCategory: 'MARKETING',
    language: 'en',
    bodyText:
      'Hi {{1}}, thanks for visiting {{2}}! We’d love to hear how it went — just reply to this message. Reply STOP to unsubscribe.',
    paramLabels: ['Customer name', 'Business name'],
    paramExamples: ['Asha', 'Sunrise Dental Clinic'],
    buttons: [
      { type: 'QUICK_REPLY', text: '😊 Great' },
      { type: 'QUICK_REPLY', text: '😐 Could be better' },
    ],
  },
];

export function getStarterTemplate(key: string): StarterTemplate | undefined {
  return STARTER_TEMPLATES.find((t) => t.key === key);
}

/** Which library tab to open first for a given business category. */
export function defaultGroupForCategory(category: string | null | undefined): StarterGroup {
  switch (category as TenantCategory | null | undefined) {
    case 'healthcare':
    case 'services':
      return 'appointments';
    case 'retail':
    case 'restaurant':
      return 'orders';
    case 'education':
      return 'alerts';
    default:
      return 'appointments';
  }
}

/** Renders {{n}} variables with their example values, for previews. */
export function renderStarterPreview(tpl: StarterTemplate): string {
  return tpl.bodyText.replace(/\{\{(\d+)\}\}/g, (_, n) => tpl.paramExamples[Number(n) - 1] ?? `{{${n}}}`);
}

/** Meta's POST /{waba_id}/message_templates components payload for a starter. */
export function starterToMetaComponents(tpl: StarterTemplate): unknown[] {
  const components: unknown[] = [
    {
      type: 'BODY',
      text: tpl.bodyText,
      ...(tpl.paramExamples.length ? { example: { body_text: [tpl.paramExamples] } } : {}),
    },
  ];
  if (tpl.buttons?.length) {
    components.push({ type: 'BUTTONS', buttons: tpl.buttons });
  }
  return components;
}
