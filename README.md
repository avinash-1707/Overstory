# Overstory

Decision-and-rationale memory for a codebase. Captures the architectural "why" that
never lived in the code and serves it to coding agents over MCP. See [`docs/`](./docs).

## Monorepo layout

```
apps/
  api/   Hono — machine clients: MCP backend, GitHub webhooks, CLI auth
  web/   TanStack Start — human UI: Activity, Sessions, Decisions, Provocations, Flows
packages/
  db/    Drizzle schema + client (the one data layer)
  core/  domain logic: capture, serving, analysis, llm
  mcp/   @overstory/mcp — MCP server (thin client -> api)
  cli/   local capture trigger + dogfood answer client
```

Stack: TypeScript, Postgres + Drizzle, Hono, Better Auth, TanStack Start, MCP SDK, ts-morph
(see `docs/reference/decision-logs.md`, D21/D26/D29). Internal-packages pattern — packages
export `src` directly; apps bundle them (no per-package build step in dev).

## Develop

```sh
pnpm install
pnpm dev          # turbo: all apps
pnpm typecheck
pnpm build
```

Copy `.env.example` -> `.env` and fill in. Build order is risk-first: capture loop
(the moat) is validated before serving + dashboard are built.
