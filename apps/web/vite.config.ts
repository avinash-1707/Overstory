import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'

// TanStack Start — human UI (D29): Activity, Sessions (+ Decisions/Provocations/Flows later).
// Plugin order: tailwindcss() MUST precede tanstackStart() (Tailwind v4 + Start guide).
export default defineConfig({
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
})
