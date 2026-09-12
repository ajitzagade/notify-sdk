export type MetaTemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';

/**
 * Meta's per-message India rate card (INR) for template (HSM) sends, as of 2026-09.
 * Session/service replies within the 24h window are free and aren't priced here.
 * Meta doesn't expose this via API — update manually when they revise pricing.
 */
const INDIA_RATE_CARD_INR: Record<MetaTemplateCategory, number> = {
  MARKETING:      0.8631,
  UTILITY:        0.1150,
  AUTHENTICATION: 0.1150,
};

export function ratePerMessageINR(category: string): number | null {
  return INDIA_RATE_CARD_INR[category.toUpperCase() as MetaTemplateCategory] ?? null;
}

export function estimateCampaignCostINR(category: string, recipientCount: number): number | null {
  const rate = ratePerMessageINR(category);
  return rate === null ? null : rate * recipientCount;
}

export function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
