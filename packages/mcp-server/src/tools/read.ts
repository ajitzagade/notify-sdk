import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { NotifyApiClient } from '../client';

/** Read-only tools — always registered, regardless of NOTIFY_MCP_ENABLE_WRITES. */
export function registerReadTools(server: McpServer, api: NotifyApiClient): void {
  server.registerTool(
    'list_recent_logs',
    {
      title: 'List recent WhatsApp send events',
      description:
        "Returns this tenant's 50 most recent WhatsApp message events (sent/delivered/read/failed), " +
        'including recipient, template, status, and timestamps. Read-only.',
    },
    async () => {
      const logs = await api.getRecentLogs();
      return { content: [{ type: 'text', text: JSON.stringify(logs, null, 2) }] };
    }
  );
}
