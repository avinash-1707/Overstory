import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

// Tool descriptions are written as imperatives — they are part of the prevent
// mechanism (D17): the agent decides to call a tool from its name + description, so
// the wording is load-bearing. Tune these during dogfood until the agent bites.
//
//   overstory_context  — always-on tier (D20), call at task start
//   overstory_guard    — file->decisions prevent (D17), call before editing
//   overstory_decision — read one decision in full
// check (D11) + search land after dogfood validates the agent actually pulls.

export interface ServeConfig {
  apiUrl: string // no trailing slash
  apiKey: string
  sessionId: string
}

type ToolResult = { content: { type: 'text'; text: string }[] }

export function registerTools(server: McpServer, cfg: ServeConfig): void {
  server.registerTool(
    'overstory_context',
    {
      title: "Overstory: this repo's always-on architectural decisions",
      description:
        "Fetch Overstory's always-on architectural decisions for this repo. Call this ONCE " +
        'at the START of any coding task, before planning changes — these are the cross-cutting ' +
        'decisions that shape where and how you should work.',
      inputSchema: {},
    },
    async () => text(await call(cfg, 'GET', '/v1/mcp/context')),
  )

  server.registerTool(
    'overstory_guard',
    {
      title: 'Overstory: decisions governing the files you are about to edit',
      description:
        'BEFORE editing files, call this with the repo-relative paths you are about to change ' +
        'to get the recorded design decisions and rationale that govern them. Read these before ' +
        "choosing an approach, so you don't undo an intentional design.",
      inputSchema: {
        files: z.array(z.string()).describe('repo-relative paths you are about to edit'),
      },
    },
    async ({ files }) => text(await call(cfg, 'POST', '/v1/mcp/guard', { files })),
  )

  server.registerTool(
    'overstory_decision',
    {
      title: 'Overstory: read one decision in full',
      description:
        'Read a single Overstory decision in full (statement, rationale, and the files it ' +
        'governs), by its id — e.g. an id returned by overstory_context or overstory_guard.',
      inputSchema: { id: z.string().describe('the decision id') },
    },
    async ({ id }) => text(await call(cfg, 'GET', `/v1/mcp/decision/${encodeURIComponent(id)}`)),
  )
}

// Call the backend. Degrade OPEN: if Overstory is unreachable or errors, return an
// empty/annotated result so the agent is never blocked (a broken Overstory must be no
// worse than an absent one). Never throws.
async function call(
  cfg: ServeConfig,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<unknown> {
  try {
    const res = await fetch(`${cfg.apiUrl}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${cfg.apiKey}`,
        'x-overstory-session': cfg.sessionId,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(4000),
    })
    if (res.status === 404) return { decisions: [], note: 'no matching decision' }
    if (!res.ok) {
      console.error(`overstory-mcp: backend ${res.status} on ${method} ${path}`)
      return { decisions: [], error: `overstory backend returned ${res.status}` }
    }
    return await res.json()
  } catch (err) {
    console.error('overstory-mcp: backend unreachable', err)
    return { decisions: [], unavailable: true }
  }
}

function text(data: unknown): ToolResult {
  // Serialize defensively — degrade-open must hold even if a result isn't cleanly
  // JSON-serializable, so the stringify can't escape as a thrown error to the agent.
  let body: string
  try {
    body = JSON.stringify(data, null, 2)
  } catch {
    body = '{ "decisions": [], "unavailable": true }'
  }
  return { content: [{ type: 'text', text: body }] }
}
