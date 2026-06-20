import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { authClient } from '../lib/auth-client'
import { AuthCard, Divider, ErrorSlot, Input, LabeledField, SubmitButton } from '../marketing/AuthCard'

export const Route = createFileRoute('/sign-in')({
  component: SignInPage,
})

function SignInPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(undefined)
    setLoading(true)

    try {
      const result = await authClient.signIn.email({
        email,
        password,
      })

      if (result.error) {
        setError(result.error.message ?? 'Sign in failed. Please check your credentials.')
      } else {
        navigate({ to: '/sessions' })
      }
    } catch (err) {
      setError('Unable to connect. Please try again shortly.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard title="Welcome back">
      <form onSubmit={handleSubmit} noValidate>
        <ErrorSlot message={error} />

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
              autoComplete="current-password"
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
        </LabeledField>

        <div style={{ textAlign: 'right', marginTop: '-8px', marginBottom: '20px' }}>
          <button
            type="button"
            title="Password reset is coming soon"
            style={{
              fontSize: '12px',
              color: 'var(--fg-subtle)',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              transition: 'color 180ms var(--ease-out)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--fg-muted)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-subtle)')}
          >
            Forgot your password?
          </button>
        </div>

        <SubmitButton loading={loading}>
          {loading ? 'Signing in' : 'Sign in'}
        </SubmitButton>
      </form>

      <Divider />

      <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--fg-muted)', margin: 0 }}>
        Don't have an account?{' '}
        <Link
          to="/sign-up"
          style={{
            color: 'var(--accent)',
            textDecoration: 'none',
            fontWeight: 500,
            transition: 'color 180ms var(--ease-out)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--accent)')}
        >
          Sign up
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
