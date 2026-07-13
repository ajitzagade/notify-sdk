#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config';
import { NotifyApiClient } from './client';
import { registerReadTools } from './tools/read';
import { registerWriteTools } from './tools/write';

async function main(): Promise<void> {
  const config = loadConfig();
  const api = new NotifyApiClient(config);

  const server = new McpServer({ name: 'notify-sdk', version: '0.1.0' });

  registerReadTools(server, api);
  if (config.writesEnabled) {
    registerWriteTools(server, api);
  } else {
    console.error('[notify-mcp-server] Write tools disabled (set NOTIFY_MCP_ENABLE_WRITES=true to enable send/opt-in/opt-out).');
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[notify-mcp-server] Connected — ${config.apiBaseUrl}, writes ${config.writesEnabled ? 'enabled' : 'disabled'}.`);
}

main().catch((err) => {
  console.error('[notify-mcp-server] Fatal error:', err);
  process.exit(1);
});
