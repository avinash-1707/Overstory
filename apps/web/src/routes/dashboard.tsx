import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { DashboardTopBar } from '../components/DashboardTopBar'
import { seo } from '../lib/seo'
import { getSession } from '../server/auth.functions'

// Authenticated dashboard shell (D28). Top tab bar + content area. beforeLoad gates every
// /dashboard/* route on a Better Auth session (redirect to /sign-in if absent). Tenant data is
// scoped to the session's workspace (D36). Head is static + noindex; never read session/loader
// data into it (tenant-leak guard).
export const Route = createFileRoute('/dashboard')({
  head: () => seo({ title: 'Dashboard', noindex: true }),
  beforeLoad: async () => {
    const session = await getSession()
    if (!session) throw redirect({ to: '/sign-in' })
    return { user: session.user }
  },
  component: DashboardLayout,
})

function DashboardLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      <DashboardTopBar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
