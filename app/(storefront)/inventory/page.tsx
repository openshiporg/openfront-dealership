import { Suspense } from 'react'
import type { Metadata } from 'next'

import { InventoryPage } from '@/features/storefront/screens/InventoryPage'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Inventory' }

export default function Page() {
  return <Suspense fallback={null}><InventoryPage /></Suspense>
}
