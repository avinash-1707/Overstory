import { defineConfig } from 'vitest/config'

// Unit tests only (no Vite/React plugins needed): the leak-critical tenant-scope resolver is pure,
// so it runs in a plain node environment with no db/env. See docs/technical/multi-tenant.md.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
