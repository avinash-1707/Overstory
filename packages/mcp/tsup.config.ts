import { defineConfig } from 'tsup'

// The .mcp.json launches `node dist/index.js` (raw node, no TS loader), so workspace deps
// that export TypeScript source (@overstory/config) must be BUNDLED in, not externalized.
// Real npm deps (@modelcontextprotocol/sdk, zod) stay external and resolve from node_modules.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  clean: true,
  noExternal: [/^@overstory\//],
})
