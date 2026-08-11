/// <reference types="vite/client" />
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

import appCss from '../styles.css?url'

const directionContract = `
THESIS: Treat patch routing as measurable evidence on a signal bench, refusing the generic node-editor dashboard.
OWN-WORLD: CRT black and graphite panels, etched green graticules, restrained phosphor traces, and amber warning states.
STORY: Acquire a local patch, read its complete audio path, select a module, and inspect the exact signal details.
FIRST VIEWPORT: The graph owns the calibrated scope surface; patch readout sits above and the selected module docks at right.
FORM: Reviewer light-table staging adapted as an instrument bench; direction seed bec773f4.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
`

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'theme-color', content: '#090d0b' },
      { name: 'description', content: 'Understand Empress ZOIA patches as logical audio signal-flow graphs.' },
      { title: 'ZOIA / SCOPE — Patch Visualizer' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const installContract = `document.body.insertBefore(document.createComment(${JSON.stringify(directionContract)}), document.body.firstChild)`
  const installTheme = `try{const saved=localStorage.getItem('zoia-scope-theme');document.documentElement.dataset.theme=saved==='dark'||saved==='light'?saved:(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark')}catch{document.documentElement.dataset.theme='dark'}`

  return (
    <html lang="en" suppressHydrationWarning>
      <head><HeadContent /></head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: `${installTheme};${installContract}` }} />
        {children}
        <Scripts />
      </body>
    </html>
  )
}
