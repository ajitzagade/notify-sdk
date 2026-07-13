import { IStorageAdapter, NotifyEvent, RecipientPreference, InboundReply } from '../../types';

/**
 * InMemoryAdapter — zero dependencies, stores everything in Maps.
 * Perfect for development, testing, or scripts.
 * Data is lost when the process restarts.
 */
export class InMemoryAdapter implements IStorageAdapter {
  private events      = new Map<string, NotifyEvent>();
  private waIdIndex   = new Map<string, string>(); // waMessageId → logId
  private preferences = new Map<string, RecipientPreference>();
  private replies: InboundReply[] = [];

  async logEvent(event: Partial<NotifyEvent>): Promise<string> {
    const id = event.id ?? crypto.randomUUID();
    const record: NotifyEvent = {
      id,
      to:          event.to ?? '',
      template:    event.template ?? '',
      status:      event.status ?? 'queued',
      tags:        event.tags,
      meta:        event.meta,
      bodyPreview: event.bodyPreview,
    };
    this.events.set(id, record);
    return id;
  }

  async updateEvent(id: string, update: Partial<NotifyEvent>): Promise<void> {
    const existing = this.events.get(id);
    if (!existing) return;
    const updated = { ...existing, ...update };
    this.events.set(id, updated);
    if (update.waMessageId) {
      this.waIdIndex.set(update.waMessageId, id);
    }
  }

  async updateByWaMessageId(waMessageId: string, update: Partial<NotifyEvent>): Promise<void> {
    const id = this.waIdIndex.get(waMessageId);
    if (id) await this.updateEvent(id, update);
  }

  async getEvent(id: string): Promise<NotifyEvent | null> {
    return this.events.get(id) ?? null;
  }

  async getPreference(phone: string): Promise<RecipientPreference | null> {
    return this.preferences.get(phone) ?? null;
  }

  async setPreference(phone: string, pref: Partial<RecipientPreference>): Promise<void> {
    const existing = this.preferences.get(phone) ?? { phone, optedIn: false };
    this.preferences.set(phone, { ...existing, ...pref });
  }

  async getRecentEvents(limit = 50): Promise<NotifyEvent[]> {
    return Array.from(this.events.values()).slice(-limit);
  }

  async logReply(reply: InboundReply): Promise<void> {
    this.replies.push(reply);
  }

  /** Dev helper — dump all stored data */
  dump(): { events: NotifyEvent[]; preferences: RecipientPreference[]; replies: InboundReply[] } {
    return {
      events:      Array.from(this.events.values()),
      preferences: Array.from(this.preferences.values()),
      replies:     [...this.replies],
    };
  }
}
