import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { authClient } from '../lib/auth-client'
import { AuthCard, Divider, ErrorSlot, Input, LabeledField, SubmitButton } from '../marketing/AuthCard'
import { seo } from '../lib/seo'
import { getSession } from '../server/auth.functions'

export const Route = createFileRoute('/sign-up')({
  head: () => seo({ title: 'Sign up', noindex: true }),
  // Already authenticated -> skip the form, go to the app (inverse of _dashboard's guard).
  beforeLoad: async () => {
    if (await getSession()) throw redirect({ to: '/dashboard' })
  },
  component: SignUpPage,
})

type StrengthLevel = 0 | 1 | 2 | 3

function getStrength(password: string): StrengthLevel {
  if (!password) return 0
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
  if (/[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password)) score++
  return Math.min(score, 3) as StrengthLevel
}

const STRENGTH_LABELS: Record<StrengthLevel, string> = {
  0: '',
  1: 'Weak',
  2: 'Fair',
  3: 'Strong',
}

const STRENGTH_COLORS: Record<StrengthLevel, string> = {
  0: 'var(--border)',
  1: 'var(--danger)',
  2: 'var(--accent)',
  3: 'var(--success)',
}

function PasswordStrengthBar({ password }: { password: string }) {
  const level = getStrength(password)
  const showBar = password.length > 0

  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '5px' }}>
        {([1, 2, 3] as StrengthLevel[]).map((seg) => (
          <div
            key={seg}
            style={{
              flex: 1,
              height: '3px',
              borderRadius: '2px',
              background: showBar && level >= seg ? STRENGTH_COLORS[level] : 'var(--border)',
              transition: 'background 280ms var(--ease-out)',
            }}
          />
        ))}
      </div>
      <p
        style={{
          fontSize: '11px',
          color: showBar && level > 0 ? STRENGTH_COLORS[level] : 'transparent',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          margin: 0,
          transition: 'color 280ms var(--ease-out)',
          minHeight: '14px',
        }}
      >
        {STRENGTH_LABELS[level]}
      </p>
    </div>
  )
}

function SignUpPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(undefined)

    if (!name.trim()) {
      setError('Please enter your name.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)

    try {
      const result = await authClient.signUp.email({
        name: name.trim(),
        email,
        password,
      })

      if (result.error) {
        setError(result.error.message ?? 'Sign up failed. Please try again.')
      } else {
        navigate({ to: '/dashboard' })
      }
    } catch (err) {
      setError('Unable to connect. Please try again shortly.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard title="Create your account">
      <form onSubmit={handleSubmit} noValidate>
        <ErrorSlot message={error} />

        <LabeledField label="Name" htmlFor="name">
          <Input
            id="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            error={!!error && !name.trim()}
            placeholder="Your name"
          />
        </LabeledField>

        <LabeledField label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            error={!!error}
            placeholder="you@example.com"
          />
        </LabeledField>

        <LabeledField label="Password" htmlFor="password">
          <div style={{ position: 'relative' }}>
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              error={!!error}
              style={{ paddingRight: '44px' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--fg-subtle)',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                lineHeight: 1,
                transition: 'color 180ms var(--ease-out)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--fg-muted)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-subtle)')}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          <PasswordStrengthBar password={password} />
        </LabeledField>

        <SubmitButton loading={loading}>
          {loading ? 'Creating account' : 'Create account'}
        </SubmitButton>
      </form>

      <Divider />

      <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--fg-muted)', margin: 0 }}>
        Already have an account?{' '}
        <Link
          to="/sign-in"
          style={{
            color: 'var(--accent)',
            textDecoration: 'none',
            fontWeight: 500,
            transition: 'color 180ms var(--ease-out)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--accent)')}
        >
          Sign in
        </Link>
      </p>
    </AuthCard>
  )
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}
