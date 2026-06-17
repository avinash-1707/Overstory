import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { ThemeToggle } from '../components/ThemeToggle'

// Authenticated dashboard shell (D28). Sidebar + content. Auth guard + workspace/repo
// switcher arrive with the auth pass; for now the dogfood workspace is resolved server-side.
export const Route = createFileRoute('/_dashboard')({
  component: DashboardLayout,
})

function DashboardLayout() {
  return (
    <div className="flex min-h-screen bg-bg text-fg">
      <aside className="flex w-[220px] shrink-0 flex-col border-r border-border bg-surface">
        {/* Wordmark */}
        <div className="flex items-center gap-2.5 px-5 py-5">
          <Mark />
          <span className="font-display text-xl tracking-tight text-fg">Overstory</span>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 px-3 pt-1">
          <NavLink to="/sessions" label="Sessions" />
          <NavLink to="/activity" label="Activity" />
        </nav>

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between border-t border-border px-4 py-3">
          <span className="text-2xs text-fg-subtle">Dogfood workspace</span>
          <ThemeToggle />
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
      className="flex items-center rounded-md px-3 py-2 text-sm text-fg-muted transition-colors hover:bg-raised hover:text-fg"
      activeProps={{
        className:
          'flex items-center rounded-md px-3 py-2 text-sm border-l-2 border-accent bg-raised text-fg pl-[10px]',
      }}
    >
      {label}
    </Link>
  )
}

function Mark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M8 1.5L13.5 8L8 14.5L2.5 8L8 1.5Z" fill="var(--accent)" opacity="0.9"/>
      <path d="M8 5L11 8L8 11L5 8L8 5Z" fill="var(--bg)"/>
    </svg>
  )
}
