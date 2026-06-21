import { Link, useNavigate } from '@tanstack/react-router'
import { ThemeToggle } from './ThemeToggle'
import { authClient } from '../lib/auth-client'

function Mark() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M8 1.5L13.5 8L8 14.5L2.5 8L8 1.5Z" fill="var(--accent)" opacity="0.9" />
      <path d="M8 5L11 8L8 11L5 8L8 5Z" fill="var(--bg)" />
    </svg>
  )
}

export function DashboardTopBar() {
  const navigate = useNavigate()

  return (
    <header className="flex h-14 w-full shrink-0 items-center border-b border-border bg-surface px-5">
      {/* LEFT: logo + wordmark */}
      <div className="flex items-center gap-2.5">
        <Mark />
        <span className="font-display text-xl tracking-tight text-fg">Overstory</span>
      </div>

      {/* CENTER-LEFT: nav tabs */}
      <nav className="ml-8 flex h-full items-end gap-1">
        <Link
          to="/dashboard/sessions"
          activeOptions={{ exact: false }}
          className="flex h-full items-center px-3 pb-px text-sm text-fg-muted transition-colors hover:text-fg"
          activeProps={{
            className:
              'flex h-full items-center px-3 pb-px text-sm text-fg border-b-2 border-accent',
          }}
        >
          Sessions
        </Link>
        <Link
          to="/dashboard/activity"
          className="flex h-full items-center px-3 pb-px text-sm text-fg-muted transition-colors hover:text-fg"
          activeProps={{
            className:
              'flex h-full items-center px-3 pb-px text-sm text-fg border-b-2 border-accent',
          }}
        >
          Activity
        </Link>
      </nav>

      {/* RIGHT: workspace label + theme toggle + sign out */}
      <div className="ml-auto flex items-center gap-3">
        <span className="text-2xs text-fg-subtle">Dogfood workspace</span>
        <ThemeToggle />
        <button
          type="button"
          onClick={async () => {
            // Navigate regardless: if signOut rejected and the session survived, the /sign-in
            // guard bounces back to /dashboard; never strand the user on a half-cleared session.
            try {
              await authClient.signOut()
            } finally {
              navigate({ to: '/sign-in' })
            }
          }}
          className="text-2xs text-fg-subtle transition-colors hover:text-fg"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
