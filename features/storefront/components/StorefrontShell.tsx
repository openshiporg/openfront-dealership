import { Archivo, Instrument_Sans } from 'next/font/google'
import type { CSSProperties, ReactNode } from 'react'
import '@/features/storefront/styles/storefront.css'
import { ComparisonBar } from './ComparisonBar'
import { Footer } from './Footer'
import { Header } from './Header'
import OpenfrontCTA from './OpenfrontCTA'
import { StorefrontBusinessProvider } from './StorefrontBusinessProvider'
import type { StorefrontSettingsState } from '../lib/business'

const display = Archivo({
  variable: '--font-storefront-display',
  subsets: ['latin'],
  axes: ['wdth'],
})

const body = Instrument_Sans({
  variable: '--font-storefront-body',
  subsets: ['latin'],
})

type StorefrontBrandStyle = CSSProperties & {
  '--sf-logo-hue': string
}

function StorefrontUnavailable() {
  return (
    <div className={`storefront ${display.variable} ${body.variable} min-h-screen`}>
      <div className="sf-container flex min-h-screen items-center justify-center py-16">
        <section className="max-w-md text-center" aria-live="polite">
          <p className="sf-eyebrow">Error</p>
          <h1 className="sf-display mt-3 text-[length:var(--sf-text-2xl)]">We couldn&apos;t load this page.</h1>
          <div className="sf-track mt-6">
            <a href="" className="sf-pill sf-pill-primary">Retry</a>
          </div>
        </section>
      </div>
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
        className={`storefront ${display.variable} ${body.variable} min-h-screen flex flex-col`}
        style={brandStyle}
      >
        <Header />
        <div className="flex-1 pb-28 sm:pb-16">{children}</div>
        <ComparisonBar />
        <Footer />
        {!hideBranding && <OpenfrontCTA />}
      </div>
    </StorefrontBusinessProvider>
  )
}
