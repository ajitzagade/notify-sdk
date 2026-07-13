import { z } from 'zod/v3';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { NotifyApiClient } from '../client';

/**
 * Write tools — only registered when the caller has explicitly set
 * NOTIFY_MCP_ENABLE_WRITES=true (see config.ts / index.ts). An AI assistant
 * should not be able to send real WhatsApp messages or change a customer's
 * opt-in status just by having this server pointed at a tenant's API key;
 * that has to be a deliberate, separate decision by whoever configures it.
 *
 * send-bulk is deliberately not exposed at all, in this package or the
 * underlying client — a single misfired tool call sending one message is a
 * very different blast radius than one sending a broadcast to an entire
 * list, and an LLM-driven tool is exactly the context where "are you sure"
 * doesn't get a chance to run.
 */
export function registerWriteTools(server: McpServer, api: NotifyApiClient): void {
  server.registerTool(
    'send_message',
    {
      title: 'Send a WhatsApp message',
      description:
        "Sends a single free-form text message from this tenant's WhatsApp number to one phone number. " +
        'Only reaches customers who have already opted in — blocked otherwise, same as every other send path.',
      inputSchema: {
        to:   z.string().describe('Recipient phone number, international format without "+", e.g. "919876543210"'),
        text: z.string().describe('The message text to send'),
      },
    },
    async ({ to, text }) => {
      const event = await api.sendMessage({ to, template: 'text', text });
      return { content: [{ type: 'text', text: JSON.stringify(event, null, 2) }] };
    }
  );

  server.registerTool(
    'opt_in_contact',
    {
      title: 'Opt a phone number in',
      description: 'Marks a phone number as opted-in to receive WhatsApp messages from this tenant, and sends a confirmation message.',
      inputSchema: {
        phone: z.string().describe('Phone number, international format without "+"'),
      },
    },
    async ({ phone }) => {
      const result = await api.optIn(phone);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    'opt_out_contact',
    {
      title: 'Opt a phone number out',
      description: 'Marks a phone number as opted-out — future sends to it will be blocked until they opt back in.',
      inputSchema: {
        phone: z.string().describe('Phone number, international format without "+"'),
      },
    },
    async ({ phone }) => {
      const result = await api.optOut(phone);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );
}
