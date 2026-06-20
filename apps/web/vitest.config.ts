import { defineConfig } from 'vitest/config'

// Unit tests only (no Vite/React plugins needed): the leak-critical tenant-scope resolver is pure,
// so it runs in a plain node environment with no db/env. See docs/technical/multi-tenant.md.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // The opt-in boundary test (OVERSTORY_RUN_DB_TESTS) hits a remote Postgres — each
    // resolveDashCtx is several round-trips, so the 5s default is too tight. Pure unit tests
    // finish in ms regardless.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
