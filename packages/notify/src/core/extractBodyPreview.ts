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

/**
 * Renders an HSM template's real body text by substituting {{n}} placeholders
 * with the body-parameter values from a send's `components`. The template
 * definition (with the body text) comes from the caller's synced wa_templates
 * copy — the SDK itself never reads that table, so this stays a pure function.
 * Returns undefined when the definition has no BODY text, letting callers
 * fall back to extractBodyPreview()'s "[Template: name]".
 */
export function renderHsmBody(
  templateComponents: Array<Record<string, unknown>>,
  sendComponents?: Array<{ type: string; parameters?: Array<{ type: string; text?: string }> }>
): string | undefined {
  const bodyDef = templateComponents.find((c) => String(c.type).toUpperCase() === 'BODY');
  const text    = bodyDef?.text as string | undefined;
  if (!text) return undefined;

  const params =
    sendComponents?.find((c) => c.type.toLowerCase() === 'body')?.parameters ?? [];
  return text.replace(/\{\{\s*(\d+)\s*\}\}/g, (match, n) => params[Number(n) - 1]?.text ?? match);
}
