/**
 * Pulls a short human-readable preview of what was actually sent out of a
 * built WhatsApp API payload (see TemplateEngine.build()'s return shapes),
 * so notify_log can show more than just a template name — needed for the
 * shared inbox's thread view to display real message content on the
 * outbound side, not just "[text message sent]".
 */
export function extractBodyPreview(payload: Record<string, unknown>): string | undefined {
  const type = payload.type as string | undefined;

  if (type === 'text') {
    const text = payload.text as { body?: string } | undefined;
    return text?.body;
  }

  if (type === 'interactive') {
    const interactive = payload.interactive as { body?: { text?: string } } | undefined;
    return interactive?.body?.text;
  }

  if (type === 'template') {
    const template = payload.template as { name?: string } | undefined;
    return template?.name ? `[Template: ${template.name}]` : undefined;
  }

  if (type === 'image' || type === 'video' || type === 'document' || type === 'audio') {
    const media = payload[type] as { caption?: string } | undefined;
    return media?.caption || `[${type}]`;
  }

  return undefined;
}
