/**
 * Env-var configuration. `NOTIFY_API_KEY` is a tenant API key issued from
 * the admin console's API Keys tab — this server is scoped to exactly one
 * tenant, the same as any other /v1 API consumer.
 */
export interface Config {
  apiBaseUrl: string;
  apiKey: string;
  /** Off by default — send/opt-in/opt-out tools only register when this is explicitly "true". */
  writesEnabled: boolean;
}

export function loadConfig(): Config {
  const apiKey = process.env.NOTIFY_API_KEY;
  if (!apiKey) {
    throw new Error('[notify-mcp-server] NOTIFY_API_KEY is not set — issue one from the admin console\'s API Keys tab.');
  }

  return {
    apiBaseUrl:    (process.env.NOTIFY_API_BASE_URL ?? 'http://localhost:3011').replace(/\/$/, ''),
    apiKey,
    writesEnabled: process.env.NOTIFY_MCP_ENABLE_WRITES === 'true',
  };
}
