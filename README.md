# Overstory

Overstory is a memory of architectural decisions for AI coding agents. It records the reasoning
behind how a codebase is built, and it hands that reasoning to a coding agent while the agent is
working, so the agent does not quietly undo a choice the team made on purpose.

The hardest thing to keep alive in a codebase is not the code. It is the reasoning that never
made it into the code: the obvious default that was deliberately avoided, and the reason it was
avoided. People forget it, and an agent never knew it. Overstory captures that reasoning once,
then surfaces it at the moment it matters: when someone is about to change the file it applies to.

## How it works

There are two halves: capturing decisions, and serving them.

**Capturing.** You run the capture loop on a part of the codebase. Overstory analyzes it, picks
the decisions an agent is most likely to get wrong, and pushes back with a plausible alternative
("why not just do it this way instead?"). You either accept the alternative or reject it and say
why in a sentence. That sentence becomes the recorded rationale. Overstory stores the decision
along with the files it governs. It keeps the why and the where, never the code itself, and it
never overwrites or deletes, it only adds.

**Serving.** A coding agent reads those decisions through five MCP tools. Serving is read only and
scoped to the repo behind the agent's key. It also fails safe: if Overstory is down or erroring,
every tool simply returns nothing, so a broken Overstory is never worse than not having it at all.
Every read is logged, so you can see what the agent actually pulled and whether it bothered to
check at all.

## The five tools an agent uses

| Tool | When the agent calls it | What it gets back |
|---|---|---|
| `overstory_context` | once, at the start of a task | the always-on decisions that shape the whole repo |
| `overstory_guard` | right before editing files | the decisions that govern those exact files |
| `overstory_check` | after drafting a change, before finalizing it | any decision the change might contradict |
| `overstory_search` | when it does not yet know which files it will touch | decisions relevant to a short description of the task |
| `overstory_decision` | to read one decision in full | the full statement, rationale, and file pointers |

`overstory_check` is the only one that calls a model. It is a warning, not a gate: it tells the
agent what looks contradictory and lets the agent decide.

## Project layout

This is a pnpm and Turbo monorepo.

```
apps/
  api/   The backend for machines (port 3001). Serves the MCP tools, takes captures
         from the CLI, logs reads, and hosts the auth handler.
  web/   The human UI (port 3000). Landing page, sign in, and a dashboard that shows
         agent sessions and activity.
packages/
  core/   The domain logic: capture, serving, contradiction checks, analysis, the LLM
          client, auth config, and dashboard queries.
  db/     The Drizzle schema and database client. One shared data layer (Postgres, on Neon).
  cli/    The `overstory` command. Runs the capture loop and answers provocations.
  mcp/    A thin MCP server that talks to the backend over HTTP.
  config/ The single place that loads and validates environment variables.
```

A couple of conventions worth knowing. The packages export their source directly and the apps
bundle them, so there is no separate build step while developing (only the CLI and MCP server
build a dist for shipping). Every model call goes through one OpenRouter client. And the tenant
boundary, which repo you are allowed to see, always comes from your authenticated key or session,
never from anything the client sends.

The stack is TypeScript, Postgres with Drizzle, Hono, Better Auth, TanStack Start, the MCP SDK,
OpenRouter, and ts-morph.

## Getting started

You will need Node 20 or newer, pnpm 10, and a Postgres database. Neon works well.

```sh
pnpm install
cp .env.example .env
```

Fill in `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `OPENROUTER_API_KEY` at a minimum. Then set up
the database and create your first key:

```sh
pnpm db:push                          # create the tables
pnpm --filter @overstory/api seed     # make a workspace, a repo, and an API key
```

The seed prints the API key once. Copy it into `.env` as `OVERSTORY_API_KEY`. Now run the apps:

```sh
pnpm --filter @overstory/api dev      # backend on port 3001
pnpm --filter @overstory/web dev      # web UI on port 3000
```

Or run everything at once with `pnpm dev`.

To capture some decisions and see them show up:

```sh
pnpm --filter @overstory/cli dev capture path/to/some/code
pnpm --filter @overstory/api stats    # a quick look at what agents have pulled
```

## Environment variables

These are loaded and checked once by `@overstory/config`. Read them through that package, not
through `process.env`. Each process only needs the ones it actually uses.

| Variable | Who uses it | Notes |
|---|---|---|
| `DATABASE_URL` | db, api, web | Postgres connection string |
| `BETTER_AUTH_SECRET` | api, web | required, or sessions can be forged |
| `BETTER_AUTH_URL` | api | the auth handler's origin (defaults to port 3001) |
| `WEB_BASE_URL` | web | the web origin (defaults to port 3000) |
| `OPENROUTER_API_KEY` | api, cli | the model key. If it is missing, `check` just returns nothing |
| `OVERSTORY_MODEL_REASONING`, `OVERSTORY_MODEL_FAST` | api, cli | optional model overrides |
| `OVERSTORY_API_URL`, `OVERSTORY_API_KEY` | cli, mcp | how the machine clients reach the backend |
| `OVERSTORY_OPEN_SIGNUP` | api, web | sign up is closed unless this is set to `"true"` |
| `PORT` | api | backend port, defaults to 3001 |

## Accounts and access

Machines (the CLI and the MCP server) authenticate with a bearer key that starts with `osk_`.
Only its hash is stored. Each key belongs to one workspace and repo, and every read is scoped to
that repo. Keys can expire or be revoked.

People sign in to the dashboard with email and password through Better Auth.

Sign up is turned off by default. Right now the dashboard always shows the one seeded workspace,
so leaving sign up open would let a stranger register and read it. When you need to create your
own account, set `OVERSTORY_OPEN_SIGNUP=true`, restart, sign up, then turn it back off.

## Running Overstory on itself

This repo uses Overstory on its own decisions. The `.mcp.json` file launches the built MCP server
(`packages/mcp/dist/index.js`), so build it once with `pnpm --filter @overstory/mcp build`. The
habits an agent should follow while working here, calling `context` at the start, `guard` before
editing, and `check` before finalizing, are written up in [`CLAUDE.md`](./CLAUDE.md).

## A note on the database schema

The schema is kept in sync with `drizzle-kit push`. There are no migration files. One thing to
watch out for: the version of drizzle-kit in use cannot read the `NULLS NOT DISTINCT` unique
constraint on the `pointers` table, so a full `push` will wrongly offer to recreate it. Until that
is sorted out, apply one-off schema changes with a direct `ALTER` instead. The auth tables in
`packages/db/src/schema/auth.ts` are generated by the Better Auth CLI, so do not edit them by hand.

## Common commands

```sh
pnpm dev          # run the apps in watch mode
pnpm build        # build everything
pnpm typecheck    # type-check every package
pnpm lint         # run eslint
pnpm format       # run prettier
pnpm db:push      # sync the schema to the database
```

## Where the reasoning lives

The thinking behind the design is in [`docs/`](./docs):

- [`reference/decision-logs.md`](./docs/reference/decision-logs.md) is the running log of decisions and why they were made.
- [`technical/`](./docs/technical) has the build specs for the capture loop, serving, data model, and dashboard.
- [`product/`](./docs/product) covers the vision and the risks still being tested.
- [`audits/`](./docs/audits) holds the data-flow security audits.

## Status

The capture loop and all five serving tools are built, and so is the dashboard that shows agent
activity. The most recent [security audit](./docs/audits/2026-06-19.md) has been worked through its
high and medium findings. Two larger pieces are still ahead: a GitHub App that checks pull requests
for contradictions, and proper multi-tenant scoping so the dashboard follows the signed-in user.
