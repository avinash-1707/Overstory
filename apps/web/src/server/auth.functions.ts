import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { redirect } from '@tanstack/react-router'
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
  // Throw a router redirect, not a bare Error (L6 audit): a bare Error surfaces as an opaque
  // 500 server-fn failure on client-side revalidation after the session expires. TanStack's
  // RPC layer recognizes a thrown redirect() and the client router navigates to /sign-in —
  // mirroring the _dashboard beforeLoad guard, so a direct RPC hit behaves like a UI nav.
  if (!session) throw redirect({ to: '/sign-in' })
  return session
}
