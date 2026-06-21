import { describe, expect, it } from 'vitest'
import { seo } from './seo'
import { DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from './site'

const title = (m: ReturnType<typeof seo>['meta']) =>
  m.find((d): d is { title: string } => 'title' in d)?.title
const byName = (m: ReturnType<typeof seo>['meta'], n: string) =>
  m.find((d): d is { name: string; content: string } => 'name' in d && d.name === n)?.content
const byProp = (m: ReturnType<typeof seo>['meta'], p: string) =>
  m.find((d): d is { property: string; content: string } => 'property' in d && d.property === p)?.content

describe('seo()', () => {
  it('templates a fragment title and bare site name on landing', () => {
    expect(title(seo({ title: 'Sign in' }).meta)).toBe(`Sign in · ${SITE_NAME}`)
    expect(title(seo().meta)).toBe(SITE_NAME)
  })

  it('emits description only when provided', () => {
    expect(byName(seo().meta, 'description')).toBeUndefined()
    expect(byName(seo({ description: 'x' }).meta, 'description')).toBe('x')
  })

  it('landing OG block: absolute image + url, twitter card, canonical', () => {
    const r = seo({ description: 'd', og: { type: 'website' } })
    expect(byProp(r.meta, 'og:image')).toBe(DEFAULT_OG_IMAGE)
    expect(byProp(r.meta, 'og:image')).toMatch(/^https?:\/\//)
    expect(byProp(r.meta, 'og:url')).toBe(SITE_URL)
    expect(byName(r.meta, 'twitter:card')).toBe('summary_large_image')
    expect(r.links?.[0]).toEqual({ rel: 'canonical', href: SITE_URL })
  })

  it('gated pages: noindex, NO description/OG (tenant-leak guard)', () => {
    const r = seo({ title: 'Dashboard', noindex: true })
    expect(byName(r.meta, 'robots')).toBe('noindex')
    expect(byName(r.meta, 'description')).toBeUndefined()
    expect(byProp(r.meta, 'og:title')).toBeUndefined()
    expect(r.links).toBeUndefined()
  })

  it('SITE_URL has no trailing slash (prevents // in absolute URLs)', () => {
    expect(SITE_URL.endsWith('/')).toBe(false)
  })
})
