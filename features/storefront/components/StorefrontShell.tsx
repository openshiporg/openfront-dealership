import { Overpass, Overpass_Mono, Public_Sans } from 'next/font/google'
import type { CSSProperties, ReactNode } from 'react'
import '@/features/storefront/styles/signage.css'
import { ComparisonBar } from './ComparisonBar'
import { Footer } from './Footer'
import { Header } from './Header'
import { StorefrontBusinessProvider } from './StorefrontBusinessProvider'
import type { StorefrontSettingsState } from '../lib/business'

// Overpass descends from Highway Gothic, the lettering of road and lot signs.
const display = Overpass({
  variable: '--font-storefront-display',
  subsets: ['latin'],
})

const body = Public_Sans({
  variable: '--font-storefront-body',
  subsets: ['latin'],
})

const mono = Overpass_Mono({
  variable: '--font-storefront-mono',
  subsets: ['latin'],
})

type StorefrontBrandStyle = CSSProperties & {
  '--sf-logo-hue': string
}

function StorefrontUnavailable() {
  return (
    <div className={`storefront ${display.variable} ${body.variable} ${mono.variable} min-h-screen`}>
      <main className="sf-container flex min-h-screen items-center justify-center py-16">
        <section className="max-w-md text-center" aria-live="polite">
          <h1 className="sf-display text-[length:var(--sf-text-2xl)]">We couldn&apos;t load this page.</h1>
          <div className="sf-track mt-6">
            <a href="" className="sf-pill sf-pill-primary">Retry</a>
          </div>
        </section>
      </main>
    </div>
  )
}

export function StorefrontShell({
  children,
  settings,
}: {
  children: ReactNode
  settings: StorefrontSettingsState
}) {
  if (settings.status === 'error') {
    return <StorefrontUnavailable />
  }

  const { business } = settings
  const brandStyle: StorefrontBrandStyle = { '--sf-logo-hue': business.logoColor }
  const hideBranding = process.env.HIDE_OPENFRONT_BRANDING === 'true'

  return (
    <StorefrontBusinessProvider business={business}>
      <div
        className={`storefront ${display.variable} ${body.variable} ${mono.variable} min-h-screen flex flex-col`}
        style={brandStyle}
      >
        <Header />
        <main className="sf-main flex-1">{children}</main>
        <Footer branding={!hideBranding} />
        <ComparisonBar />
      </div>
    </StorefrontBusinessProvider>
  )
}
