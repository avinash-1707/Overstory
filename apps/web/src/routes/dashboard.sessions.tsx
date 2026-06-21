import { createFileRoute, Outlet } from '@tanstack/react-router'

// Layout for the Sessions tab. Renders either the list (index route) or a session detail
// ($sessionId route) into this Outlet. This Outlet is the fix for detail pages not opening:
// previously the list WAS this route's component, so the nested detail had nowhere to mount.
export const Route = createFileRoute('/dashboard/sessions')({
  component: () => <Outlet />,
})
