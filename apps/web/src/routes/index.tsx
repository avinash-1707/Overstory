import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <main style={{ fontFamily: 'system-ui', padding: '2rem' }}>
      <h1>Overstory</h1>
      <p>Decision-and-rationale memory for a codebase. Scaffold — views coming.</p>
    </main>
  )
}
