import { createFileRoute, Link, Outlet } from '@tanstack/react-router'

// Authenticated dashboard shell (D28). Sidebar + content. Auth guard + workspace/repo
// switcher arrive with the auth pass; for now the dogfood workspace is resolved server-side.
export const Route = createFileRoute('/_dashboard')({
  component: DashboardLayout,
})

function DashboardLayout() {
  return (
    <div className="flex min-h-screen bg-bg text-fg">
      <aside className="flex w-[220px] shrink-0 flex-col border-r border-border bg-surface">
        <div className="px-5 py-5">
          <span className="font-display text-xl tracking-tight">Overstory</span>
        </div>
        <nav className="flex flex-col gap-0.5 px-3">
          <NavLink to="/sessions" label="Sessions" />
          <NavLink to="/activity" label="Activity" />
        </nav>
        <div className="mt-auto border-t border-border px-5 py-4 text-xs text-fg-subtle">
          Dogfood workspace
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

function NavLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="rounded-md px-3 py-2 text-sm text-fg-muted transition-colors hover:bg-raised hover:text-fg"
      activeProps={{ className: 'rounded-md px-3 py-2 text-sm bg-accent-muted text-accent' }}
    >
      {label}
    </Link>
  )
}
