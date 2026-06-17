import { createFileRoute } from '@tanstack/react-router'
import { auth } from '../../../server/auth'

// Catch-all for /api/auth/* — forwards every request to Better Auth's handler, which
// returns a full Response including Set-Cookie (D37: web serves its own auth, no CORS).
export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: ({ request }) => auth.handler(request),
    },
  },
})
