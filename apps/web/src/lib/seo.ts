import { DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from './site'

// Build a TanStack Start head() payload from a small, intent-based input. Pure (no server
// imports) so it is safe in the client bundle. Title is emitted as a { title } meta descriptor
// (TanStack renders one <title>, deepest route wins on merge). OG/Twitter/canonical are emitted
// ONLY when `og` is set, so gated pages can never accidentally publish a description or card.

export type MetaDescriptor =
  | { title: string }
  | { name: string; content: string }
  | { property: string; content: string }

export interface SeoInput {
  /** Page title fragment, e.g. "Sign in". Omit on the landing page to keep the bare site name. */
  title?: string
  /** Public pages only. Never pass tenant/loader data here. */
  description?: string
  /** Landing/public only: emit the Open Graph + Twitter card block. */
  og?: { image?: string; url?: string; type?: 'website' | 'article' }
  /** Gated/auth pages: add <meta name="robots" content="noindex">. */
  noindex?: boolean
}

export interface SeoResult {
  meta: MetaDescriptor[]
  links?: { rel: string; href: string }[]
}

export function seo({ title, description, og, noindex }: SeoInput = {}): SeoResult {
  const fullTitle = title ? `${title} · ${SITE_NAME}` : SITE_NAME
  const meta: MetaDescriptor[] = [{ title: fullTitle }]

  if (description) meta.push({ name: 'description', content: description })
  if (noindex) meta.push({ name: 'robots', content: 'noindex' })

  if (og) {
    const image = og.image ?? DEFAULT_OG_IMAGE
    const url = og.url ?? SITE_URL
    meta.push(
      { property: 'og:title', content: fullTitle },
      { property: 'og:type', content: og.type ?? 'website' },
      { property: 'og:url', content: url },
      { property: 'og:image', content: image },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: fullTitle },
      { name: 'twitter:image', content: image },
    )
    if (description) {
      meta.push(
        { property: 'og:description', content: description },
        { name: 'twitter:description', content: description },
      )
    }
    return { meta, links: [{ rel: 'canonical', href: url }] }
  }

  return { meta }
}
