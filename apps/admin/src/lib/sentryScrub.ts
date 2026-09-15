import type { ErrorEvent } from '@sentry/nextjs';

function redact(text: string): string {
  return text
    .replace(/Bearer\s+[A-Za-z0-9._-]{10,}/gi, 'Bearer [redacted]')
    .replace(/\b\d{10,15}\b/g, '[redacted-number]');
}

/**
 * Strips anything that looks like a phone number or bearer token from
 * exception messages before an event leaves the process — e.g. a Postgres
 * constraint-violation error embeds the literal offending value
 * (tenant_id, contact_phone) in its message text. False positives (a long
 * ID that isn't a phone number) are an acceptable trade for never leaking a
 * real customer's number to a third-party processor.
 */
export function scrubPii(event: ErrorEvent): ErrorEvent {
  for (const value of event.exception?.values ?? []) {
    if (value.value) value.value = redact(value.value);
  }
  if (event.message) event.message = redact(event.message);
  return event;
}
