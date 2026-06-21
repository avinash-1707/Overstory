/// <reference types="vite/client" />
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import appCss from '../styles.css?url'
import { SITE_NAME, THEME_COLOR } from '../lib/site'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // Document defaults. Per-route head() merges over this; a child { title } descriptor or any
  // meta with the same name/property wins, so routes override the bare site name + add their own
  // description/OG. Favicon links are relative (resolved against the current origin).
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'theme-color', content: THEME_COLOR },
      { title: SITE_NAME },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
    ],
  }),
  component: RootComponent,
})

const THEME_INIT = `(function(){try{var t=localStorage.getItem('overstory-theme');if(t==='light')document.documentElement.setAttribute('data-theme','light');}catch(e){}})();`

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  )
}
