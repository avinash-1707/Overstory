import { getRequestHeaders } from '@tanstack/react-start/server'
import { redirect } from '@tanstack/react-router'
import { auth } from './auth'

// The authenticated Better Auth session ({ user, session }). Threaded into resolveDashCtx (D36)
// so tenant scope derives from the verified userId.
export type Session = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>

// Server-only session guard for data server functions. NOT a createServerFn — a plain fn whose
// body is NOT stripped from the client bundle — so it MUST live in a module that no client route
// imports, else its @tanstack/react-start/server + better-auth imports leak into the browser
// build (the Start import-protection plugin rejects that). It is referenced only inside the
// createServerFn handlers in functions.ts, where the compiler dead-code-eliminates this import
// from the client build. (The server-only-import boundary — see CLAUDE.md.)
//
// The route beforeLoad only gates UI navigation; the data RPC endpoints are independently
// reachable, so every one must re-check the session here. Throws a router redirect to /sign-in
// when unauthenticated (L6 audit): a bare Error would surface as an opaque 500 on client
// revalidation after the session expires; TanStack's RPC layer turns a thrown redirect into a
// client navigation, mirroring the _dashboard beforeLoad guard.
export async function requireSession(): Promise<Session> {
  const session = await auth.api.getSession({ headers: getRequestHeaders() })
  if (!session) throw redirect({ to: '/sign-in' })
  return session
}
