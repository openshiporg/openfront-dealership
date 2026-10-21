import { Fraunces, DM_Sans } from 'next/font/google'
import type { CSSProperties, ReactNode } from 'react'
import '@/features/storefront/styles/storefront.css'
import { ComparisonBar } from './ComparisonBar'
import { Footer } from './Footer'
import { Header } from './Header'
import OpenfrontCTA from './OpenfrontCTA'
import { StorefrontBusinessProvider } from './StorefrontBusinessProvider'
import type { StorefrontSettingsState } from '../lib/business'

const display = Fraunces({
  variable: '--font-storefront-display',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

const body = DM_Sans({
  variable: '--font-storefront-body',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

type StorefrontBrandStyle = CSSProperties & {
  '--sf-logo-hue': string
}

function StorefrontUnavailable() {
  return (
    <div className={`storefront ${display.variable} ${body.variable} min-h-screen`}>
      <div className="sf-container flex min-h-screen items-center justify-center py-16">
        <section className="sf-card max-w-xl p-8 text-center" aria-live="polite">
          <h1 className="sf-display text-[length:var(--sf-text-2xl)]">We couldn&apos;t load this page.</h1>
          <p className="mt-4 text-[var(--sf-text-sm)]" style={{ color: 'var(--sf-ink-2)' }}>
            Please try again.
          </p>
          <a href="" className="sf-btn sf-btn-primary mt-6 inline-flex">Retry</a>
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
        <div className="flex-1 pb-36 sm:pb-20">{children}</div>
        <ComparisonBar />
        <Footer />
        {!hideBranding && <OpenfrontCTA />}
      </div>
    </StorefrontBusinessProvider>
  )
}
