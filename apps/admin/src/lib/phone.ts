const DEFAULT_COUNTRY_CODE = '91';

/**
 * Strips formatting and applies a default country code (India) to bare
 * 10-digit numbers, so ops/tenants don't have to type it on every phone
 * number entered by hand (Test Send, CSV import). Meta's API always needs
 * the full country-code-prefixed number regardless — this only saves typing
 * it here. Anything that isn't exactly 10 digits after stripping (already
 * has a country code, or is a non-Indian number) is left untouched, so this
 * never rewrites a number that's already fully specified.
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '');
  return digits.length === 10 ? `${DEFAULT_COUNTRY_CODE}${digits}` : digits;
}
