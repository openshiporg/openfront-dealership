import type { Metadata } from 'next'

import { StorefrontShell } from '@/features/storefront'
import { loadStorefrontBusiness } from '@/features/storefront/lib/data/storefront-business'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const settings = await loadStorefrontBusiness()

  if (settings.status === 'error') {
    return { title: "We couldn't load this page", robots: { index: false, follow: false } }
  }

  const { business } = settings
  return {
    title: {
      default: business.homepageTitle || business.fullName,
      template: `%s | ${business.shortName}`,
    },
    description: business.homepageDescription || undefined,
  }
}

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const settings = await loadStorefrontBusiness()
  return <StorefrontShell settings={settings}>{children}</StorefrontShell>
}
