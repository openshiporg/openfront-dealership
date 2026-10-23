import type { MetadataRoute } from 'next'

import { storefrontOrigin } from '@/features/storefront/lib/data/site-origin'

export const dynamic = 'force-dynamic'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await storefrontOrigin()
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/dashboard', '/api', '/account'] },
    sitemap: `${origin}/sitemap.xml`,
  }
}
