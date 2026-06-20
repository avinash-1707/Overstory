import { env } from '@overstory/config'

// Minimal structured logger: one JSON object per line, no dependency. Machine clients and
// log shippers parse JSON lines directly; canonical keys (ts/level/msg) always win over
// caller fields. Level gated by LOG_LEVEL (default info). warn/error -> stderr, else stdout
// (so a downstream collector can split severity by stream). Errors are serialized to
// {name,message,stack} — never logged as "[object Object]". Never log secrets (api keys,
// tokens): pass identifiers, not credentials.

type Level = 'debug' | 'info' | 'warn' | 'error'
type Fields = Record<string, unknown>

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 }
const threshold = ORDER[env.LOG_LEVEL ?? 'info']

function serialize(fields?: Fields): Fields {
  if (!fields) return {}
  const out: Fields = {}
  for (const [k, v] of Object.entries(fields)) {
    out[k] = v instanceof Error ? { name: v.name, message: v.message, stack: v.stack } : v
  }
  return out
}

function emit(level: Level, msg: string, fields?: Fields): void {
  if (ORDER[level] < threshold) return
  // Canonical keys last so a stray field named ts/level/msg can never shadow them.
  const line = JSON.stringify({ ...serialize(fields), ts: new Date().toISOString(), level, msg })
  ;(level === 'warn' || level === 'error' ? process.stderr : process.stdout).write(line + '\n')
}

export const log = {
  debug: (msg: string, fields?: Fields) => emit('debug', msg, fields),
  info: (msg: string, fields?: Fields) => emit('info', msg, fields),
  warn: (msg: string, fields?: Fields) => emit('warn', msg, fields),
  error: (msg: string, fields?: Fields) => emit('error', msg, fields),
}
