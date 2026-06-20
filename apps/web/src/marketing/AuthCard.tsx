import { Link } from '@tanstack/react-router'

interface AuthCardProps {
  title: string
  children: React.ReactNode
}

export function AuthCard({ title, children }: AuthCardProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <Link
        to="/"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '20px',
          color: 'var(--fg)',
          textDecoration: 'none',
          letterSpacing: '-0.01em',
          marginBottom: '36px',
          display: 'block',
        }}
      >
        Overstory
      </Link>

      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '36px 32px',
          animation: 'fade-up 300ms var(--ease-out) both',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '26px',
            fontWeight: 400,
            letterSpacing: '-0.01em',
            color: 'var(--fg)',
            marginBottom: '28px',
          }}
        >
          {title}
        </h1>

        {children}
      </div>
    </div>
  )
}

interface LabeledFieldProps {
  label: string
  htmlFor: string
  children: React.ReactNode
}

export function LabeledField({ label, htmlFor, children }: LabeledFieldProps) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label
        htmlFor={htmlFor}
        style={{
          display: 'block',
          fontSize: '13px',
          fontWeight: 500,
          color: 'var(--fg-muted)',
          marginBottom: '6px',
        }}
      >
        {label}
      </label>
      {children}
    </div>
  )
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export function Input({ error, style, ...props }: InputProps) {
  return (
    <input
      {...props}
      style={{
        display: 'block',
        width: '100%',
        background: 'var(--raised)',
        border: `1px solid ${error ? 'var(--danger)' : 'var(--border)'}`,
        borderRadius: '6px',
        color: 'var(--fg)',
        fontSize: '15px',
        padding: '9px 12px',
        outline: 'none',
        transition: 'border-color 180ms var(--ease-out)',
        boxSizing: 'border-box',
        fontFamily: 'var(--font-sans)',
        ...style,
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = error ? 'var(--danger)' : 'var(--accent)'
        props.onFocus?.(e)
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = error ? 'var(--danger)' : 'var(--border)'
        props.onBlur?.(e)
      }}
    />
  )
}

interface ErrorSlotProps {
  message?: string
}

export function ErrorSlot({ message }: ErrorSlotProps) {
  return (
    <div
      aria-live="polite"
      style={{
        minHeight: '36px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {message && (
        <p
          style={{
            fontSize: '13px',
            color: 'var(--danger)',
            background: 'var(--danger-muted)',
            border: '1px solid rgba(196,81,58,0.25)',
            borderRadius: '6px',
            padding: '8px 12px',
            margin: 0,
            width: '100%',
          }}
        >
          {message}
        </p>
      )}
    </div>
  )
}

interface SubmitButtonProps {
  loading?: boolean
  children: React.ReactNode
}

export function SubmitButton({ loading, children }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={loading}
      style={{
        display: 'flex',
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        background: loading ? 'var(--accent-muted)' : 'var(--accent)',
        color: loading ? 'var(--accent)' : 'var(--bg)',
        border: 'none',
        borderRadius: '6px',
        fontSize: '15px',
        fontWeight: 600,
        fontFamily: 'var(--font-sans)',
        padding: '11px 20px',
        cursor: loading ? 'not-allowed' : 'pointer',
        transition: 'background 200ms var(--ease-out)',
        marginTop: '8px',
      }}
      onMouseEnter={(e) => {
        if (!loading) e.currentTarget.style.background = 'var(--accent-hover)'
      }}
      onMouseLeave={(e) => {
        if (!loading) e.currentTarget.style.background = 'var(--accent)'
      }}
    >
      {loading && (
        <span
          style={{
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            border: '2px solid var(--accent)',
            borderTopColor: 'transparent',
            display: 'inline-block',
            animation: 'spin 600ms linear infinite',
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </button>
  )
}

interface DividerProps {
  label?: string
}

export function Divider({ label = 'or' }: DividerProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        margin: '20px 0',
      }}
    >
      <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      <span
        style={{
          fontSize: '12px',
          color: 'var(--fg-subtle)',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
    </div>
  )
}
