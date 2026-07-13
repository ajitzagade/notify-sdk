// ─── Core config ────────────────────────────────────────────────────────────

export interface NotifyConfig {
  /** Meta WhatsApp Cloud API permanent system user token */
  accessToken: string;
  /** Phone Number ID from Meta Developer Dashboard */
  phoneNumberId: string;
  /** WhatsApp Business Account ID — required only for syncTemplates() (template listing is WABA-scoped, not phone-number-scoped) */
  wabaId?: string;
  /** Webhook verify token — any string you choose */
  verifyToken?: string;
  /** App Secret from Meta Developer Dashboard — used for webhook HMAC validation */
  appSecret?: string;
  /** Queue adapter. Defaults to InlineQueueAdapter (no Redis) */
  queue?: IQueueAdapter;
  /** Storage adapter. Defaults to InMemoryAdapter */
  storage?: IStorageAdapter;
  /** Global defaults applied to every send call */
  defaults?: {
    timezone?: string;
    quietHours?: { start: number; end: number };
    retries?: number;
    retryDelayMs?: number;
  };
  /** Called after every successful send */
  onSent?: (event: NotifyEvent) => void;
  /** Called after every failed send (after all retries exhausted) */
  onFailed?: (event: NotifyEvent, error: Error) => void;
  /** Called when a team member replies via WhatsApp button or text */
  onReply?: (reply: InboundReply) => void;
  /** Called when Meta confirms message delivered to device */
  onDelivered?: (event: NotifyEvent) => void;
  /** Called when recipient reads the message */
  onRead?: (event: NotifyEvent) => void;
  /** Custom logger. Defaults to console */
  logger?: NotifyLogger;
}

// ─── Send options ────────────────────────────────────────────────────────────

export interface MediaAttachment {
  type: 'image' | 'video' | 'document' | 'audio';
  /** Public HTTPS URL (e.g. a Vercel Blob URL) — Meta fetches it directly */
  link?: string;
  /** Meta media ID from a prior WhatsAppHttpClient.uploadMedia() call */
  id?: string;
  /** Not supported by Meta for type 'audio' */
  caption?: string;
  /** Only used for type 'document' */
  filename?: string;
}

// ─── Real WhatsApp (HSM) templates ─────────────────────────────────────────────
// These are Meta's pre-approved templates (`type: "template"` messages), required
// to message a user outside the 24-hour session window. Distinct from the local
// JS-function template registry above (`notify.registerTemplate()`), which only
// produces free-form session messages.

export interface HsmParameter {
  type: 'text' | 'currency' | 'date_time' | 'image' | 'video' | 'document';
  text?: string;
  /** Used when type = 'image' — fills an approved template's IMAGE header. */
  image?: { link: string };
  /** Used when type = 'video' — fills an approved template's VIDEO header. */
  video?: { link: string };
  /** Used when type = 'document' — fills an approved template's DOCUMENT header. */
  document?: { link: string; filename?: string };
}

export interface HsmComponent {
  type: 'header' | 'body' | 'button';
  sub_type?: 'quick_reply' | 'url';
  index?: number;
  parameters?: HsmParameter[];
}

export interface MetaTemplateSummary {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components: Array<{ type: string; text?: string; format?: string; buttons?: unknown[] }>;
}

export interface SendOptions {
  /** Recipient phone in international format without +, e.g. "919876543210" */
  to: string;
  /**
   * Template name.
   * Use built-ins: 'text' | 'alert' | 'reminder' | 'approval_request' | 'status_update' | 'otp'
   * Or register custom templates with notify.registerTemplate()
   * Ignored when `attachment` or `hsmTemplate` is set.
   */
  template: string;
  /** Variables passed into the template builder */
  data?: Record<string, unknown>;
  /** Used when template = 'text' */
  text?: string;
  /** Up to 3 quick-reply button labels */
  buttons?: string[];
  /** Send an image/video/document/audio message instead of a template */
  attachment?: MediaAttachment;
  /** Send a real Meta-approved template message (works outside the 24h session window) */
  hsmTemplate?: { name: string; language: string; components?: HsmComponent[] };
  /** 'high' skips the queue and sends immediately */
  priority?: 'low' | 'normal' | 'high';
  /** Schedule delivery at a future time */
  scheduleAt?: Date;
  /** Labels for filtering notification logs */
  tags?: string[];
  /** Arbitrary metadata stored in the notification log */
  meta?: Record<string, unknown>;
}

// ─── Bulk send ───────────────────────────────────────────────────────────────

export interface BulkSendOptions extends Omit<SendOptions, 'to'> {
  recipients: string[];
  batchSize?: number;
  delayBetweenBatchesMs?: number;
  onProgress?: (progress: BulkProgress) => void;
  onRecipientSent?: (phone: string, event: NotifyEvent) => void;
  onRecipientFailed?: (phone: string, error: Error) => void;
}

export interface BulkProgress {
  broadcastId: string;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  percent: number;
  estimatedSecondsLeft: number;
}

export interface BroadcastResult {
  broadcastId: string;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  durationMs: number;
}

// ─── Events & replies ─────────────────────────────────────────────────────────

export interface NotifyEvent {
  id: string;
  to: string;
  template: string;
  waMessageId?: string;
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  tags?: string[];
  meta?: Record<string, unknown>;
  error?: string;
  /** Short human-readable preview of what was actually sent (resolved text, caption, or `[Template: name]`) — see extractBodyPreview(). */
  bodyPreview?: string;
}

export interface InboundReply {
  from: string;
  messageId: string;
  type: 'button' | 'text';
  buttonId?: string;
  buttonTitle?: string;
  text?: string;
  /**
   * The wa_message_id of the outbound message this is a reply to, when Meta
   * provides one (always present for button taps; only present for text
   * replies if the user explicitly quoted a message — a fresh, unquoted text
   * message has no context and this will be undefined).
   */
  inReplyToWaMessageId?: string;
  rawPayload: unknown;
}

// ─── Recipient preferences ────────────────────────────────────────────────────

export interface RecipientPreference {
  phone: string;
  optedIn: boolean;
  mutedUntil?: Date;
  quietHours?: { start: number; end: number };
  timezone?: string;
}

// ─── Adapter interfaces ───────────────────────────────────────────────────────

export interface QueueJob {
  logId: string;
  sendOptions: SendOptions;
  payload: unknown;
}

export interface IQueueAdapter {
  enqueue(job: QueueJob, opts?: { delay?: number }): Promise<void>;
  process(handler: (job: QueueJob) => Promise<void>): void;
}

export interface IStorageAdapter {
  logEvent(event: Partial<NotifyEvent>): Promise<string>;
  updateEvent(id: string, update: Partial<NotifyEvent>): Promise<void>;
  updateByWaMessageId(waMessageId: string, update: Partial<NotifyEvent>): Promise<void>;
  getEvent(id: string): Promise<NotifyEvent | null>;
  getPreference(phone: string): Promise<RecipientPreference | null>;
  setPreference(phone: string, pref: Partial<RecipientPreference>): Promise<void>;
  getRecentEvents(limit?: number): Promise<NotifyEvent[]>;
  /** Persists an inbound reply/button tap so it's queryable later (e.g. for campaign reply-rate reporting), not just event-emitted. */
  logReply(reply: InboundReply): Promise<void>;
}

// ─── Template ─────────────────────────────────────────────────────────────────

export type TemplateBuilder = (
  data: Record<string, unknown>,
  to: string
) => Record<string, unknown>;

// ─── Logger ───────────────────────────────────────────────────────────────────

export interface NotifyLogger {
  info:  (msg: string, meta?: unknown) => void;
  warn:  (msg: string, meta?: unknown) => void;
  error: (msg: string, meta?: unknown) => void;
  debug: (msg: string, meta?: unknown) => void;
}
