import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from './auth'

// Read the current Better Auth session server-side (from the request cookie). Used by the
// dashboard's beforeLoad guard. Returns null when there is no valid session. A createServerFn,
// so its handler (and these server-only imports) are stripped from the client bundle — safe to
// import from a client route. The plain-fn session guard for data RPCs lives in auth.guards.ts,
// which must stay server-only (see the note there).
export const getSession = createServerFn({ method: 'GET' }).handler(async () => {
  return auth.api.getSession({ headers: getRequestHeaders() })
})
