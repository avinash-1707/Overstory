import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'

export function Nav() {
  const [filled, setFilled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const onScroll = () => setFilled(window.scrollY > 32)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      ref={navRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        transition: `background 300ms var(--ease-out), border-color 300ms var(--ease-out), backdrop-filter 300ms var(--ease-out)`,
        background: filled ? 'var(--bg)' : 'transparent',
        borderBottom: `1px solid ${filled ? 'var(--border)' : 'transparent'}`,
        backdropFilter: filled ? 'blur(12px)' : 'none',
      }}
    >
      <div
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '0 24px',
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Link
          to="/"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '18px',
            color: 'var(--fg)',
            textDecoration: 'none',
            letterSpacing: '-0.01em',
          }}
        >
          Overstory
        </Link>

        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Link
            to="/sign-in"
            style={{
              fontSize: '14px',
              color: 'var(--fg-muted)',
              textDecoration: 'none',
              padding: '6px 14px',
              borderRadius: '6px',
              transition: 'color 200ms var(--ease-out)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--fg)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-muted)')}
          >
            Sign in
          </Link>
          <Link
            to="/sign-up"
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--bg)',
              background: 'var(--accent)',
              textDecoration: 'none',
              padding: '7px 16px',
              borderRadius: '6px',
              transition: 'background 200ms var(--ease-out)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--accent)')}
          >
            Get started
          </Link>
        </nav>
      </div>
    </header>
  )
}
