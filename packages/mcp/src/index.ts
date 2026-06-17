#!/usr/bin/env node
// @overstory/mcp — thin stdio MCP server. Authenticates with an ApiKey and proxies
// tool calls to the Overstory backend (api). See docs/technical/serving.md.
//
// Tools: overstory_context (always-on, D20), overstory_guard (file→decisions, D17),
// overstory_decision (read one). check + search land after dogfood validates pull.
//
// IMPORTANT: stdout is the JSON-RPC channel — diagnostics MUST go to stderr only.
import { randomUUID } from 'node:crypto'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerTools } from './tools'

// Pick up OVERSTORY_API_URL / OVERSTORY_API_KEY from the repo .env (dogfood
// convenience). loadEnvFile overwrites the ambient value for any key present in the
// file; the .mcp.json launcher passes no env, so .env is the single source here.
for (const path of ['.env', '../../.env']) {
  try {
    process.loadEnvFile(path)
  } catch {
    // not present — rely on the ambient environment
  }
}

async function main(): Promise<void> {
  const apiUrl = process.env.OVERSTORY_API_URL
  const apiKey = process.env.OVERSTORY_API_KEY
  if (!apiUrl || !apiKey) {
    console.error('overstory-mcp: OVERSTORY_API_URL and OVERSTORY_API_KEY must be set')
    process.exit(1)
  }

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
