import axios, { AxiosInstance, AxiosError } from 'axios';
import { MetaTemplateSummary } from '../types';

const GRAPH_BASE = 'https://graph.facebook.com/v20.0';

export class WhatsAppHttpClient {
  private http: AxiosInstance;

  constructor(private accessToken: string, private phoneNumberId: string, private wabaId?: string) {
    this.http = axios.create({
      baseURL: `${GRAPH_BASE}/${phoneNumberId}`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    // Log rate-limit headers for debugging
    this.http.interceptors.response.use(
      (res) => res,
      (err: AxiosError) => {
        const status = err.response?.status;
        const data   = err.response?.data as Record<string, unknown> | undefined;
        const waErr  = (data?.error as Record<string, unknown> | undefined);
        const msg    = waErr?.message ?? err.message;
        throw new Error(`WhatsApp API error (${status}): ${msg}`);
      }
    );
  }

  async post(path: string, body: unknown): Promise<Record<string, unknown>> {
    const { data } = await this.http.post(path, body);
    return data as Record<string, unknown>;
  }

  async get(path: string, params?: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { data } = await this.http.get(path, { params });
    return data as Record<string, unknown>;
  }

  /**
   * Uploads a file to Meta and returns a reusable media ID. Not needed for
   * the common case (pass a public HTTPS `link` — e.g. a Vercel Blob URL —
   * directly as `SendOptions.attachment.link`, Meta fetches it itself); this
   * is for reusing the same uploaded asset across many sends without
   * re-uploading. Uses native fetch (not the axios instance above) since
   * Node's built-in FormData/Blob handle multipart uploads without adding a
   * `form-data` dependency.
   */
  async uploadMedia(fileBuffer: Buffer, mimeType: string, filename = 'file'): Promise<{ id: string }> {
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('file', new Blob([new Uint8Array(fileBuffer)], { type: mimeType }), filename);

    const res = await fetch(`${GRAPH_BASE}/${this.phoneNumberId}/media`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${this.accessToken}` },
      body:    form,
    });
    const data = await res.json();

    if (!res.ok) {
      const message = (data?.error?.message as string) ?? `HTTP ${res.status}`;
      throw new Error(`WhatsApp API error (${res.status}): ${message}`);
    }
    return data as { id: string };
  }

  /** Resolves a Meta media ID (from uploadMedia, or an inbound message) to a temporary download URL. */
  async getMediaUrl(mediaId: string): Promise<{ url: string; mimeType: string }> {
    const { data } = await this.http.get(`${GRAPH_BASE}/${mediaId}`);
    return { url: data.url as string, mimeType: data.mime_type as string };
  }

  /**
   * Lists this WABA's approved (and pending/rejected) message templates.
   * Template listing is scoped to the WhatsApp Business Account, not the
   * phone number, so this requires `wabaId` to have been configured.
   */
  async listApprovedTemplates(): Promise<MetaTemplateSummary[]> {
    if (!this.wabaId) {
      throw new Error('[Notify] wabaId is required to sync templates — set NotifyConfig.wabaId');
    }
    const data = await this.get(`${GRAPH_BASE}/${this.wabaId}/message_templates`, {
      fields: 'name,status,category,language,components',
      limit:  100,
    });
    return (data.data as MetaTemplateSummary[]) ?? [];
  }
}
