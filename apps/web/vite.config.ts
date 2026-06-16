import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'

// TanStack Start — human UI (D29): Activity, Sessions, Decisions, Provocations, Flows.
// NOTE(scaffold): verify plugin import path + options against the installed
// @tanstack/react-start version when the web phase starts.
export default defineConfig({
  plugins: [tanstackStart(), viteReact()],
})
