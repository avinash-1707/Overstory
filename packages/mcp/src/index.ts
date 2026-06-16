#!/usr/bin/env node
// @overstory/mcp — thin MCP server. Authenticates via ApiKey (workspace+repo scoped),
// proxies tool calls to the Overstory backend (api). See docs/technical/serving.md.
//
// Tools: overstory_context, overstory_guard, overstory_check, overstory_decision, overstory_search.
// Dogfood transport: stdio. Later: hosted HTTP/SSE.
//
// TODO: wire McpServer + StdioServerTransport, register tools from ./tools, call api.

async function main() {
  throw new Error('not implemented — scaffold only')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
