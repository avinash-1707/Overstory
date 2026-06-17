/// <reference types="vite/client" />
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import appCss from '../styles.css?url'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [{ charSet: 'utf-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    links: [{ rel: 'stylesheet', href: appCss }],
    title: 'Overstory',
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
