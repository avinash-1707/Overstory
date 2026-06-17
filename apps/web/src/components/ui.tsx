// apps/web/src/components/ui.tsx
// Primitive UI components for the Overstory dashboard.
// Design: Editorial / Archival. Dark default; light via [data-theme="light"].

import { type ReactNode } from 'react'

// ─── Button ─────────────────────────────────────────────────────────────────

type ButtonVariant = 'filled' | 'ghost' | 'link'
type ButtonSize = 'sm' | 'md'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
}

const BUTTON_BASE =
  'inline-flex items-center justify-center font-sans font-medium transition-colors select-none'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  filled:
    'bg-accent text-bg hover:bg-accent-hover rounded-md active:scale-[0.97] transition-transform',
  ghost:
    'bg-transparent text-fg-muted border border-border hover:bg-raised hover:text-fg rounded-md active:scale-[0.97] transition-transform',
  link: 'bg-transparent text-accent hover:text-accent-hover underline-offset-2 hover:underline',
}

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'text-xs px-3 py-1.5 gap-1.5',
  md: 'text-sm px-4 py-2 gap-2',
}

export function Button({
  variant = 'ghost',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

// ─── Badge ───────────────────────────────────────────────────────────────────

type BadgeVariant = 'default' | 'warning' | 'danger' | 'success' | 'muted'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  className?: string
}

const BADGE_VARIANTS: Record<BadgeVariant, string> = {
  default: 'bg-raised text-fg-muted border-border',
  warning: 'bg-accent-muted text-accent border-accent/20',
  danger: 'bg-danger-muted text-danger border-danger/20',
  success: 'bg-success-muted text-success border-success/20',
  muted: 'bg-transparent text-fg-subtle border-border',
}

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-2xs font-mono leading-none ${BADGE_VARIANTS[variant]} ${className}`}
    >
      {children}
    </span>
  )
}

// ─── Tag (mono, for file paths / ids) ────────────────────────────────────────

export function Tag({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-sm border border-border bg-raised px-1.5 py-0.5 font-mono text-2xs text-fg-subtle ${className}`}
    >
      {children}
    </span>
  )
}

// ─── Card ────────────────────────────────────────────────────────────────────

interface CardProps {
  children: ReactNode
  className?: string
  padding?: 'sm' | 'md' | 'lg'
}

const CARD_PADDING: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'px-4 py-3',
  md: 'px-6 py-5',
  lg: 'px-8 py-7',
}

export function Card({ children, className = '', padding = 'md' }: CardProps) {
  return (
    <div
      className={`rounded-lg border border-border bg-surface ${CARD_PADDING[padding]} ${className}`}
    >
      {children}
    </div>
  )
}

// ─── EmptyState ──────────────────────────────────────────────────────────────

interface EmptyStateProps {
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-surface px-6 py-20 text-center">
      <div className="mb-1 text-sm font-medium text-fg">{title}</div>
      {description && (
        <p className="mt-1 max-w-xs text-xs text-fg-muted">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ─── PageHeader ──────────────────────────────────────────────────────────────

interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
  back?: ReactNode
}

export function PageHeader({ title, subtitle, action, back }: PageHeaderProps) {
  return (
    <div className="mb-8">
      {back && <div className="mb-3">{back}</div>}
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="font-display text-3xl tracking-tight text-fg">{title}</h1>
          {subtitle && (
            <p className="mt-0.5 font-mono text-xs text-fg-subtle">{subtitle}</p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
    </div>
  )
}

// ─── Spinner ─────────────────────────────────────────────────────────────────

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ animation: 'spin 0.7s linear infinite' }}
      aria-label="Loading"
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="28"
        strokeDashoffset="18"
        opacity="0.4"
      />
      <path
        d="M8 2a6 6 0 016 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
