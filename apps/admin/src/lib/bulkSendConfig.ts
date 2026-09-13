/**
 * Batch parameters passed to BulkSender for campaign sends. Kept here as the
 * single source of truth so the pre-send runtime estimate in CampaignsPanel
 * can't silently drift from what the run routes actually pass to sendBulk().
 */
export const CAMPAIGN_BATCH_SIZE = 50;
export const CAMPAIGN_BATCH_DELAY_MS = 1000;

/**
 * Lower-bound estimate: only counts the artificial inter-batch delay, not
 * per-message network time (unmeasured, varies with Meta's response time) —
 * the real run will take at least this long, usually a bit more.
 */
export function estimateCampaignRuntimeSeconds(recipientCount: number): number {
  if (recipientCount <= 0) return 0;
  const batches = Math.ceil(recipientCount / CAMPAIGN_BATCH_SIZE);
  return Math.ceil(((batches - 1) * CAMPAIGN_BATCH_DELAY_MS) / 1000);
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `~${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs ? `~${mins}m ${secs}s` : `~${mins}m`;
}
