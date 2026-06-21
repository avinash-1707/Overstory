import { createFileRoute, redirect } from '@tanstack/react-router'

// /dashboard has no page of its own: it lands on the Sessions tab (the default view).
export const Route = createFileRoute('/dashboard/')({
  beforeLoad: () => {
    throw redirect({ to: '/dashboard/sessions' })
  },
})
