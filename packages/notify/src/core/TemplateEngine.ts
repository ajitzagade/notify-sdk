import { SendOptions, TemplateBuilder } from '../types';

export class TemplateEngine {
  private registry = new Map<string, TemplateBuilder>();

  constructor() {
    this.registerBuiltins();
  }

  register(name: string, builder: TemplateBuilder): void {
    this.registry.set(name, builder);
  }

  has(name: string): boolean {
    return this.registry.has(name);
  }

  build(options: SendOptions): Record<string, unknown> {
    const base = { messaging_product: 'whatsapp', to: options.to };

    // ── Real Meta-approved (HSM) template ───────────────────────────
    // Takes priority over everything else — works outside the 24h session
    // window, unlike every other branch below.
    if (options.hsmTemplate) {
      const { name, language, components } = options.hsmTemplate;
      return {
        ...base,
        type: 'template',
        template: {
          name,
          language: { code: language },
          ...(components?.length ? { components } : {}),
        },
      };
    }

    // ── Media attachment (image/video/document/audio) ──────────────
    // Takes priority over `template` — the two are mutually exclusive.
    if (options.attachment) {
      const { type, link, id, caption, filename } = options.attachment;
      if (!link && !id) {
        throw new Error('[Notify] attachment requires either "link" or "id"');
      }
      const media: Record<string, unknown> = {};
      if (link) media.link = link;
      if (id) media.id = id;
      if (caption && type !== 'audio') media.caption = caption;
      if (filename && type === 'document') media.filename = filename;

      return { ...base, type, [type]: media };
    }

    // ── Free-form text ───────────────────────────────────────────
    if (options.template === 'text') {
      return {
        ...base,
        type: 'text',
        text: { preview_url: false, body: options.text ?? '' },
      };
    }

    // ── Interactive with inline buttons ──────────────────────────
    if (options.template === 'interactive_buttons' && options.buttons?.length) {
      return {
        ...base,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: options.text ?? '' },
          action: {
            buttons: options.buttons.slice(0, 3).map((label, i) => ({
              type: 'reply',
              reply: {
                id:    `btn_${i}_${String(options.meta?.refId ?? Date.now())}`,
                title: label,
              },
            })),
          },
        },
      };
    }

    // ── Registered template ───────────────────────────────────────
    const builder = this.registry.get(options.template);
    if (builder) {
      return { ...base, ...builder(options.data ?? {}, options.to) };
    }

    throw new Error(
      `[Notify] Template "${options.template}" not found. ` +
      `Register it with notify.registerTemplate('${options.template}', builder).`
    );
  }

  // ── Built-in templates ─────────────────────────────────────────
  private registerBuiltins(): void {

    // Generic alert with up to 3 action buttons
    this.register('alert', (data) => ({
      type: 'interactive',
      interactive: {
        type: 'button',
        header: data.title ? { type: 'text', text: String(data.title) } : undefined,
        body:   { text: String(data.body ?? '') },
        footer: data.footer ? { text: String(data.footer) } : undefined,
        action: {
          buttons: ((data.buttons as string[]) ?? ['OK'])
            .slice(0, 3)
            .map((label, i) => ({
              type:  'reply',
              reply: {
                id:    `alert_${i}_${String(data.refId ?? Date.now())}`,
                title: label,
              },
            })),
        },
      },
    }));

    // Simple text reminder
    this.register('reminder', (data) => ({
      type: 'text',
      text: {
        body:
          `Reminder: *${data.title ?? 'Upcoming item'}*\n\n` +
          `${data.body ?? ''}\n\n` +
          (data.dueDate ? `Due: ${data.dueDate}` : ''),
      },
    }));

    // Approval workflow (Approve / Reject / Defer)
    this.register('approval_request', (data) => ({
      type: 'interactive',
      interactive: {
        type: 'button',
        header: { type: 'text', text: 'Approval required' },
        body: {
          text:
            `*${data.title ?? 'New approval request'}*\n\n` +
            `Requested by: ${data.requestedBy ?? 'Unknown'}\n\n` +
            `${data.details ?? ''}`,
        },
        action: {
          buttons: [
            { type: 'reply', reply: { id: `approve_${data.refId}`, title: 'Approve' } },
            { type: 'reply', reply: { id: `reject_${data.refId}`,  title: 'Reject'  } },
            { type: 'reply', reply: { id: `defer_${data.refId}`,   title: 'Defer'   } },
          ],
        },
      },
    }));

    // Status change notification
    this.register('status_update', (data) => ({
      type: 'text',
      text: {
        body:
          `*${data.entity ?? 'Item'}* status changed\n\n` +
          `${data.from} → *${data.to}*\n\n` +
          `${data.note ?? ''}`,
      },
    }));

    // OTP / verification code
    this.register('otp', (data) => ({
      type: 'text',
      text: {
        body:
          `Your verification code is *${data.code}*\n\n` +
          `Valid for ${data.expiresIn ?? '10 minutes'}.\n` +
          `Do not share this code with anyone.`,
      },
    }));

    // Task assigned (interactive with 3 action buttons)
    this.register('task_assigned', (data) => ({
      type: 'interactive',
      interactive: {
        type: 'button',
        header: { type: 'text', text: 'New task assigned to you' },
        body: {
          text:
            `*${data.title ?? 'Untitled task'}*\n\n` +
            `Priority: ${String(data.priority ?? 'medium').toUpperCase()}\n` +
            `Project: ${data.project ?? 'General'}\n` +
            `Assigned by: ${data.assignedBy ?? 'System'}\n` +
            `Due: ${data.dueDate ?? 'No due date'}`,
        },
        footer: { text: 'Tap a button to update status' },
        action: {
          buttons: [
            { type: 'reply', reply: { id: `ack_${data.taskId}`,  title: 'Acknowledge' } },
            { type: 'reply', reply: { id: `done_${data.taskId}`, title: 'Mark done'   } },
            { type: 'reply', reply: { id: `snz_${data.taskId}`,  title: 'Snooze 2h'  } },
          ],
        },
      },
    }));

    // Due date reminder
    this.register('task_due_soon', (data) => ({
      type: 'interactive',
      interactive: {
        type: 'button',
        header: { type: 'text', text: 'Task due soon' },
        body: {
          text:
            `*${data.title ?? 'Task'}* is due in less than 24 hours.\n\n` +
            `Due: ${data.dueDate ?? 'Unknown'}\n` +
            `Status: ${data.status ?? 'pending'}\n` +
            `Priority: ${String(data.priority ?? 'medium').toUpperCase()}`,
        },
        action: {
          buttons: [
            { type: 'reply', reply: { id: `done_${data.taskId}`,  title: 'Mark done'    } },
            { type: 'reply', reply: { id: `prog_${data.taskId}`,  title: 'In progress'  } },
            { type: 'reply', reply: { id: `snz24_${data.taskId}`, title: 'Remind later' } },
          ],
        },
      },
    }));
  }
}
