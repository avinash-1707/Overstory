// Canonical repo-relative path form, shared by capture (persist) and serving (guard).
// Both sides MUST normalize identically or the path↔decision match silently misses:
// posix separators, no `./` prefix, no trailing slash, traversal segments collapsed.
// Case is preserved deliberately: repo paths are case-sensitive on Linux, so folding case
// would falsely collide distinct files (Foo.ts vs foo.ts). (L2 audit.)
export function normalizePath(p: string): string {
  return collapseDots(
    p
      .replace(/\\/g, '/')
      .trim()
      .replace(/\/+$/, ''),
  )
}

// Resolve `.`/`..` segments lexically (no filesystem touch — pure string, isomorphic).
// A traversal-shaped path like `src/../src/auth.ts` would otherwise never equal the
// canonical `src/auth.ts` stored at capture, silently missing the guard match. Leading
// `..` that escape the root are dropped (a repo-relative path can't go above its root).
function collapseDots(path: string): string {
  const out: string[] = []
  for (const seg of path.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') out.pop()
    else out.push(seg)
  }
  return out.join('/')
}
