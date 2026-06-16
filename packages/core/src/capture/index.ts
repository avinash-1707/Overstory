// Capture loop — the moat (D4/D16/D18). See docs/technical/capture-loop.md.
// Risk-first slice: rank candidate decisions (D19) and provoke (D5/D16).
// Seeding (D18), defend/persist, and contradiction detection (D11) are deferred.
export * from './ranking'
export * from './provoke'
