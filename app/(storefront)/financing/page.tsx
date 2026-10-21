import { Suspense } from 'react'
import type { Metadata } from 'next'

import { FinancingPage } from '@/features/storefront/screens/FinancingPage'

export const metadata: Metadata = { title: 'Financing' }

export default function Page() {
  return <Suspense fallback={null}><FinancingPage /></Suspense>
}
