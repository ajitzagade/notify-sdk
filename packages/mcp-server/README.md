# @orgname/notify-mcp-server

An MCP (Model Context Protocol) server that exposes a single tenant's notify-sdk `/v1` REST API to Claude, Cursor, and other MCP-compatible AI assistants. It's a thin client over `apps/api`'s existing tenant-scoped routes — same Bearer API key, same rate limiting, same guardrails any other `/v1` consumer gets. No direct database or SDK access.

Read-only by default. Write tools (send a message, opt a phone number in/out) only register when you explicitly opt in via an env var — see below.

## Getting a tenant API key

API keys are issued per tenant from `apps/admin`'s **API Keys** tab (`/tenants/[id]`, "API Keys" panel). Create one there; the raw key is shown once at creation, so copy it immediately.

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `NOTIFY_API_KEY` | Yes | — | Tenant API key from the admin console's API Keys tab. |
| `NOTIFY_API_BASE_URL` | No | `http://localhost:3011` | Base URL of the running `apps/api` server. |
| `NOTIFY_MCP_ENABLE_WRITES` | No | `false` | Set to `"true"` to register the write tools (`send_message`, `opt_in_contact`, `opt_out_contact`). Leave unset/`false` for a read-only assistant. |

## Build and run

```bash
pnpm --filter @orgname/notify-mcp-server build
NOTIFY_API_KEY=<your-tenant-key> node dist/index.js
```

## Tools

**Always registered (read-only):**
- `list_recent_logs` — the tenant's 50 most recent WhatsApp send events (sent/delivered/read/failed).

**Only registered when `NOTIFY_MCP_ENABLE_WRITES=true`:**
- `send_message` — sends a single free-form text message to one phone number. Still subject to the tenant's normal opt-in gate — blocked the same way any other send path is blocked for a non-opted-in contact.
- `opt_in_contact` — marks a phone number opted in.
- `opt_out_contact` — marks a phone number opted out.

Bulk/broadcast sending is deliberately not exposed, in this package or its underlying `NotifyApiClient` — a single misfired tool call sending one message is a very different blast radius than one sending a broadcast to an entire list, and an LLM-driven tool call is exactly the context where "are you sure?" doesn't get a chance to run.

## Example MCP client config

For a Claude Desktop / Claude Code style `mcpServers` config:

```json
{
  "mcpServers": {
    "notify-sdk": {
      "command": "node",
      "args": ["/absolute/path/to/packages/mcp-server/dist/index.js"],
      "env": {
        "NOTIFY_API_KEY": "your-tenant-api-key",
        "NOTIFY_API_BASE_URL": "http://localhost:3011",
        "NOTIFY_MCP_ENABLE_WRITES": "false"
      }
    }
  }
}
```
