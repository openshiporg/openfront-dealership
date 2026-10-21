import { Suspense } from 'react'
import type { Metadata } from 'next'

import { TradeInPage } from '@/features/storefront/screens/TradeInPage'

export const metadata: Metadata = { title: 'Trade-in' }

export default function Page() {
  return <Suspense fallback={null}><TradeInPage /></Suspense>
}
