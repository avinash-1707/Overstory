/// <reference types="vite/client" />

// Client-safe site constants. Public, non-secret. NEVER import @overstory/config here:
// seo()/head() run in the browser bundle and config pulls node-only process.loadEnvFile in at
// import (would crash/bloat the client build). The origin is a VITE_-prefixed env var
// (statically inlined at build time, client-safe by Vite's public allowlist) with a localhost
// dev fallback. Only og:image / og:url / canonical need the absolute origin; favicon links use
// relative paths the browser resolves against the current origin.
export const SITE_NAME = 'Overstory'

// Set VITE_SITE_URL=https://<domain> in prod env before launch. Until then the localhost
// fallback emits dev-only absolute URLs (canonical / og:image won't unfurl off-localhost).
export const SITE_URL = (import.meta.env.VITE_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '')

export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`

// Browser-chrome tint. Matches the dark --bg token in styles.css.
export const THEME_COLOR = '#0c0c0b'

// Public-page meta description (discreet: no internal mechanism, no em dashes). Founder-owned copy.
export const LANDING_DESCRIPTION =
  'Decision memory for AI teams. Keep the judgement behind your code, and make sure your coding agents use it.'
