import { createFileRoute, redirect } from '@tanstack/react-router'

// Dashboard-first slice: '/' lands on the dashboard (Sessions). The marketing landing
// page arrives in pass 2 and will take this route.
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/sessions' })
  },
})
