import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Nav } from './Nav'

// Entrance reveal is pure CSS (the `fade-up` keyframe in styles.css, `both` fill so it
// holds opacity:0 through the delay then settles at opacity:1). No JS / IntersectionObserver
// gate: content is always present for SSR and no-JS, and prefers-reduced-motion (handled
// globally in styles.css) collapses the duration so it simply appears.
const fadeStyle = (delay = 0): React.CSSProperties => ({
  animation: `fade-up 600ms var(--ease-out) ${delay}ms both`,
})

/* ─── Pillar data ─── */
const PILLARS = [
  {
    label: 'Coherence',
    body:
      'Every session starts from the same agreed ground. Decisions made last month still hold today, because every agent reads from the same source.',
  },
  {
    label: 'Visibility',
    body:
      'See what your agents asked, what they were told, and when a guard fired. The reasoning behind your codebase becomes legible, finally.',
  },
  {
    label: 'Continuity',
    body:
      'When the next agent arrives, or the next engineer, they inherit the judgement that went into the work, not just the output of it.',
  },
]

/* ─── Component ─── */
export function Landing() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--fg)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <Nav />

      {/* ── Hero ── */}
      <section
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '160px 24px 120px',
          position: 'relative',
        }}
      >
        {/* Subtle ruled line behind the headline */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: '140px',
            left: 0,
            right: 0,
            height: '1px',
            background: 'var(--border)',
            opacity: 0.5,
          }}
        />

        <div>
          {/* Eyebrow */}
          <p
            style={{
              ...fadeStyle(0),
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--accent)',
              marginBottom: '28px',
            }}
          >
            Decision memory for AI teams
          </p>

          {/* Headline */}
          <h1
            style={{
              ...fadeStyle(80),
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(42px, 6vw, 72px)',
              lineHeight: 1.08,
              letterSpacing: '-0.02em',
              color: 'var(--fg)',
              maxWidth: '820px',
              margin: '0 0 28px',
              fontWeight: 400,
            }}
          >
            Your codebase has a memory.
            <br />
            <em style={{ color: 'var(--fg-muted)' }}>Make sure your agents use it.</em>
          </h1>

          {/* Subhead */}
          <p
            style={{
              ...fadeStyle(160),
              fontSize: '18px',
              lineHeight: 1.65,
              color: 'var(--fg-muted)',
              maxWidth: '560px',
              margin: '0 0 44px',
            }}
          >
            Overstory captures the decisions behind your code and brings them forward,
            so every coding session starts from shared understanding, not a blank slate.
          </p>

          {/* CTAs */}
          <div
            style={{
              ...fadeStyle(240),
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <Link
              to="/sign-up"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'var(--accent)',
                color: 'var(--bg)',
                fontWeight: 600,
                fontSize: '15px',
                padding: '12px 28px',
                borderRadius: '6px',
                textDecoration: 'none',
                transition: 'background 200ms var(--ease-out), transform 200ms var(--ease-out)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--accent-hover)'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--accent)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              Get started
            </Link>
            <Link
              to="/sign-in"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                fontSize: '15px',
                color: 'var(--fg-muted)',
                textDecoration: 'none',
                padding: '12px 4px',
                transition: 'color 200ms var(--ease-out)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--fg)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-muted)')}
            >
              Sign in
              <span style={{ marginLeft: '4px', opacity: 0.6 }}>›</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Problem / Pull quote ── */}
      <section
        style={{
          borderTop: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
          padding: '72px 24px',
        }}
      >
        <div
          style={{
            maxWidth: '1100px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '64px',
            alignItems: 'center',
          }}
        >
          <div style={fadeStyle(0)}>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--fg-subtle)',
                marginBottom: '16px',
              }}
            >
              The problem
            </p>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(26px, 3vw, 36px)',
                lineHeight: 1.25,
                letterSpacing: '-0.01em',
                fontWeight: 400,
                margin: '0 0 20px',
              }}
            >
              Agents start fresh. Decisions do not travel.
            </h2>
            <p style={{ fontSize: '15px', lineHeight: 1.7, color: 'var(--fg-muted)' }}>
              Every time a coding agent opens a file, it reasons from scratch. The architecture
              choices, the tradeoffs, the things you decided not to do. None of it is there.
              So it makes its own decisions. Some of those undo yours.
            </p>
          </div>

          <blockquote
            style={{
              ...fadeStyle(120),
              margin: 0,
              padding: '28px 32px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderLeft: '3px solid var(--accent)',
              borderRadius: '0 8px 8px 0',
            }}
          >
            <p
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '22px',
                lineHeight: 1.5,
                letterSpacing: '-0.01em',
                fontStyle: 'italic',
                color: 'var(--fg)',
                margin: '0 0 20px',
              }}
            >
              "The problem is not what the agent builds. It is what the agent forgets to ask."
            </p>
            <footer
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--fg-subtle)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              On building with AI at scale
            </footer>
          </blockquote>
        </div>
      </section>

      {/* ── Benefit pillars ── */}
      <section
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '96px 24px',
        }}
      >
        <div>
          <p
            style={{
              ...fadeStyle(0),
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--fg-subtle)',
              marginBottom: '56px',
            }}
          >
            What Overstory brings
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '0',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              overflow: 'hidden',
            }}
          >
            {PILLARS.map((pillar, i) => (
              <PillarCard
                key={pillar.label}
                pillar={pillar}
                index={i}
                isLast={i === PILLARS.length - 1}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonial placeholder ── */}
      <section
        style={{
          borderTop: '1px solid var(--border)',
          padding: '80px 24px',
        }}
      >
        <div
          style={{
            maxWidth: '680px',
            margin: '0 auto',
            textAlign: 'center',
            ...fadeStyle(0),
          }}
        >
          <svg
            width="28"
            height="20"
            viewBox="0 0 28 20"
            fill="none"
            style={{ marginBottom: '24px', color: 'var(--accent)', display: 'inline-block' }}
          >
            <path
              d="M0 20V12.667C0 9.556 0.778 6.89 2.333 4.667 3.889 2.444 6.111.889 9 0l1.333 2C8.444 2.889 7 4.111 6 5.667 5 7.222 4.556 8.889 4.667 10.667H8V20H0Zm16 0V12.667c0-3.111.778-5.778 2.333-8C19.889 2.444 22.111.889 25 0l1.333 2c-1.889.889-3.333 2.111-4.333 3.667-1 1.555-1.444 3.222-1.333 5H24V20h-8Z"
              fill="currentColor"
            />
          </svg>
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(20px, 2.5vw, 28px)',
              lineHeight: 1.45,
              letterSpacing: '-0.01em',
              fontStyle: 'italic',
              color: 'var(--fg)',
              marginBottom: '28px',
            }}
          >
            "We stopped debating the same architectural questions twice. Overstory remembered
            the first conversation, so we did not have to."
          </p>
          <div>
            <p
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--fg)',
                marginBottom: '2px',
              }}
            >
              A technical founder
            </p>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--fg-subtle)',
                letterSpacing: '0.06em',
              }}
            >
              Early access
            </p>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section
        style={{
          borderTop: '1px solid var(--border)',
          padding: '100px 24px 120px',
        }}
      >
        <div
          style={{
            maxWidth: '600px',
            margin: '0 auto',
            textAlign: 'center',
          }}
        >
          <h2
            style={{
              ...fadeStyle(0),
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(32px, 4vw, 52px)',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              fontWeight: 400,
              margin: '0 0 20px',
            }}
          >
            Your next agent session should know what the last one decided.
          </h2>
          <p
            style={{
              ...fadeStyle(80),
              fontSize: '16px',
              color: 'var(--fg-muted)',
              lineHeight: 1.65,
              marginBottom: '40px',
            }}
          >
            Give your codebase a living memory. Start with a project that already has
            decisions worth keeping.
          </p>
          <div style={fadeStyle(160)}>
            <Link
              to="/sign-up"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: 'var(--accent)',
                color: 'var(--bg)',
                fontWeight: 600,
                fontSize: '15px',
                padding: '14px 36px',
                borderRadius: '6px',
                textDecoration: 'none',
                transition: 'background 200ms var(--ease-out), transform 200ms var(--ease-out)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--accent-hover)'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--accent)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              Get started
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        style={{
          borderTop: '1px solid var(--border)',
          padding: '28px 24px',
        }}
      >
        <div
          style={{
            maxWidth: '1100px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '16px',
              color: 'var(--fg-muted)',
            }}
          >
            Overstory
          </span>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--fg-subtle)',
              letterSpacing: '0.06em',
              margin: 0,
            }}
          >
            Decision memory for AI teams
          </p>
        </div>
      </footer>
    </div>
  )
}

/* ─── Pillar card sub-component ─── */
function PillarCard({
  pillar,
  index,
  isLast,
}: {
  pillar: { label: string; body: string }
  index: number
  isLast: boolean
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...fadeStyle(index * 80),
        padding: '40px 36px',
        borderRight: isLast ? 'none' : '1px solid var(--border)',
        background: hovered ? 'var(--surface)' : 'transparent',
        transition: `background 250ms var(--ease-out)`,
        cursor: 'default',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--accent)',
          marginBottom: '20px',
        }}
      >
        {String(index + 1).padStart(2, '0')} / {pillar.label}
      </p>
      <p
        style={{
          fontSize: '15px',
          lineHeight: 1.7,
          color: 'var(--fg-muted)',
        }}
      >
        {pillar.body}
      </p>
    </div>
  )
}
