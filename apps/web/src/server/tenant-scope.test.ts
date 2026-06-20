import { describe, expect, it } from 'vitest'
import { resolveOrgId, resolveRepoId } from './tenant-scope'

// The leak-critical matrix (D36). resolveOrgId is where a cross-tenant read would slip in, so the
// "must be null / must ignore the active org" cases are the load-bearing assertions: a regression
// here is a data leak, not a cosmetic bug (audit C1).
describe('resolveOrgId', () => {
  it('uses a verified active org', () => {
    // active org set AND the member check passed -> scope to it
    expect(resolveOrgId('orgA', true, ['orgA', 'orgB'])).toEqual({ orgId: 'orgA', ambiguous: false })
  })

  it('discards a stale active org and falls back to membership', () => {
    // active org set but user is NOT a member of it -> ignore active, use oldest membership
    expect(resolveOrgId('orgX', false, ['orgB'])).toEqual({ orgId: 'orgB', ambiguous: false })
  })

  it('returns null for a forged active org when the user belongs to no org (the canonical leak test)', () => {
    // active org points at a foreign org, user is a member of nothing -> NEVER the foreign org
    expect(resolveOrgId('foreignOrg', false, [])).toEqual({ orgId: null, ambiguous: false })
  })

  it('falls back to the single membership when no active org', () => {
    expect(resolveOrgId(null, false, ['orgB'])).toEqual({ orgId: 'orgB', ambiguous: false })
  })

  it('returns null for a zero-org user', () => {
    expect(resolveOrgId(null, false, [])).toEqual({ orgId: null, ambiguous: false })
  })

  it('picks the oldest org and flags ambiguity for a multi-org user', () => {
    // memberOrgIds is oldest-first; pick [0], flag for a warn
    expect(resolveOrgId(null, false, ['orgOld', 'orgNew'])).toEqual({ orgId: 'orgOld', ambiguous: true })
  })

  it('does not trust activeOrgIsMember=true when activeOrgId is null', () => {
    // defensive: a null active org can never be "the verified active org"
    expect(resolveOrgId(null, true, ['orgB'])).toEqual({ orgId: 'orgB', ambiguous: false })
  })
})

describe('resolveRepoId', () => {
  it('returns null when the org has no repo', () => {
    expect(resolveRepoId([])).toEqual({ repoId: null, ambiguous: false })
  })

  it('picks the single repo', () => {
    expect(resolveRepoId(['r1'])).toEqual({ repoId: 'r1', ambiguous: false })
  })

  it('picks the oldest repo and flags ambiguity when the org has many', () => {
    expect(resolveRepoId(['rOld', 'rNew'])).toEqual({ repoId: 'rOld', ambiguous: true })
  })
})
