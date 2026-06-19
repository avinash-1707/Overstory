#!/usr/bin/env node
// @overstory/mcp — thin stdio MCP server. Authenticates with an ApiKey and proxies
// tool calls to the Overstory backend (api). See docs/technical/serving.md.
//
// Tools: overstory_context (always-on, D20), overstory_guard (file→decisions, D17),
// overstory_check (contradiction catch, D11), overstory_decision (read one). search lands later.
//
// IMPORTANT: stdout is the JSON-RPC channel — diagnostics MUST go to stderr only.
import { randomUUID } from 'node:crypto'
import { requireEnv } from '@overstory/config'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerTools } from './tools'

// Env (OVERSTORY_API_URL / OVERSTORY_API_KEY) is loaded + validated by @overstory/config
// (it reads the repo .env on import; the .mcp.json launcher passes no env, so .env is the
// single source). requireEnv throws if either is missing — caught by main().catch below.

async function main(): Promise<void> {
  const apiUrl = requireEnv('OVERSTORY_API_URL')
  const apiKey = requireEnv('OVERSTORY_API_KEY')

  const server = new McpServer({ name: 'overstory', version: '0.0.0' })
  // One stdio connection = one agent session (D28) — groups this run's ServeEvents.
  registerTools(server, { apiUrl: apiUrl.replace(/\/$/, ''), apiKey, sessionId: randomUUID() })

  await server.connect(new StdioServerTransport())
  console.error('overstory-mcp: ready')
}

main().catch((err: unknown) => {
  console.error('overstory-mcp: failed to start', err)
  process.exit(1)
})
