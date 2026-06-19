import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

// Tool descriptions are written as imperatives — they are part of the prevent
// mechanism (D17): the agent decides to call a tool from its name + description, so
// the wording is load-bearing. Tune these during dogfood until the agent bites.
//
//   overstory_context  — always-on tier (D20), call at task start
//   overstory_guard    — file->decisions prevent (D17), call before editing
//   overstory_check    — contradiction CATCH (D11), call after drafting a change
//   overstory_search   — fuzzy task -> decisions (D32), when the locus isn't known yet
//   overstory_decision — read one decision in full

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

  server.registerTool(
    'overstory_check',
    {
      title: 'Overstory: check a change against recorded decisions before finalizing',
      description:
        'AFTER drafting a change but BEFORE finalizing it, call this with the repo-relative ' +
        'files you changed and a short summary of what you did. Returns any recorded design ' +
        'decisions your change may contradict, so you can reconsider before committing.',
      inputSchema: {
        files: z.array(z.string()).describe('repo-relative paths you changed'),
        summary: z.string().describe('a short summary of what you changed'),
      },
    },
    // Longer timeout than the reads: check runs an LLM judgment server-side (~10-30s).
    async ({ files, summary }) =>
      text(await call(cfg, 'POST', '/v1/mcp/check', { files, summary }, 60_000)),
  )

  server.registerTool(
    'overstory_search',
    {
      title: 'Overstory: find decisions relevant to a task',
      description:
        "When you don't yet know which files you'll touch, call this with a short description " +
        "of what you're about to build or change to find the architectural decisions relevant " +
        'to it. Use it at task start to surface decisions the always-on set may not cover.',
      inputSchema: {
        query: z.string().describe('a short description of what you are about to build or change'),
      },
    },
    async ({ query }) => text(await call(cfg, 'POST', '/v1/mcp/search', { query })),
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
  timeoutMs = 8000,
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
      // Generous ceiling: serving does a Neon round-trip and remote Neon RTT from a dev box
      // is ~1s (plus scale-to-zero cold starts). 4s used to clip the p100 → spurious
      // degrade-open. check overrides this (LLM judgment ~10-30s). Still bounded so a truly
      // dead backend never hangs the agent.
      signal: AbortSignal.timeout(timeoutMs),
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
