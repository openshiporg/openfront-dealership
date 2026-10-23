import type { MetadataRoute } from 'next'

import { listedVehicleIds } from '@/features/storefront/lib/data/sitemap-inventory'
import { storefrontOrigin } from '@/features/storefront/lib/data/site-origin'

export const dynamic = 'force-dynamic'

const PAGES = ['/', '/inventory', '/financing', '/trade-in', '/test-drive', '/service', '/contact']

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [origin, ids] = await Promise.all([storefrontOrigin(), listedVehicleIds()])
  return [
    ...PAGES.map((path) => ({ url: `${origin}${path}` })),
    ...ids.map((id) => ({ url: `${origin}/inventory/${encodeURIComponent(id)}` })),
  ]
}
