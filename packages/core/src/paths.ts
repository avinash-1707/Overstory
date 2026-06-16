// Canonical repo-relative path form, shared by capture (persist) and serving (guard).
// Both sides MUST normalize identically or the path↔decision match silently misses:
// posix separators, no `./` prefix, no trailing slash.
export function normalizePath(p: string): string {
  return p
    .replace(/\\/g, '/')
    .trim()
    .replace(/^\.\//, '')
    .replace(/\/+$/, '')
}
