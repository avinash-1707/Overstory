import { defineConfig } from 'tsup'

// The `overstory` bin runs `node dist/index.js` (raw node), so workspace deps that export
// TypeScript source (@overstory/*) must be BUNDLED in, not externalized. Real npm deps stay
// external and resolve from node_modules.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  clean: true,
  noExternal: [/^@overstory\//],
})
