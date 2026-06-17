import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from './auth'

// Read the current Better Auth session server-side (from the request cookie). Used by the
// dashboard's beforeLoad guard. Returns null when there is no valid session.
export const getSession = createServerFn({ method: 'GET' }).handler(async () => {
  return auth.api.getSession({ headers: getRequestHeaders() })
})

// Server-side guard for data server functions. The route beforeLoad only gates UI
// navigation; the data RPC endpoints are independently reachable, so every one must
// re-check the session here. Throws when unauthenticated. Runs inside a server fn handler
// (server-side), so getRequestHeaders() is available.
export async function requireSession() {
  const session = await auth.api.getSession({ headers: getRequestHeaders() })
  if (!session) throw new Error('Unauthorized')
  return session
}
