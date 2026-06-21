import { existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Gates the DoD on the static head assets actually being committed: the favicon set + the one
// hand-made Open Graph card. A referenced-but-missing asset (e.g. og:image -> 404) is the silent
// failure mode for link unfurls, so make it machine-checkable. Paths are relative to this file:
// src/lib -> ../../public == apps/web/public.
const ASSETS = ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'og-default.png']

describe('public/ head assets', () => {
  for (const name of ASSETS) {
    const path = fileURLToPath(new URL(`../../public/${name}`, import.meta.url))
    it(`${name} exists and is non-empty`, () => {
      expect(existsSync(path)).toBe(true)
      expect(statSync(path).size).toBeGreaterThan(0)
    })
  }
})
