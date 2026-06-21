import { createFileRoute } from '@tanstack/react-router'
import { Landing } from '../marketing/Landing'
import { seo } from '../lib/seo'
import { LANDING_DESCRIPTION } from '../lib/site'

export const Route = createFileRoute('/')({
  // The only public, indexable page: full description + Open Graph/Twitter card + canonical.
  head: () => seo({ description: LANDING_DESCRIPTION, og: { type: 'website' } }),
  component: Landing,
})
