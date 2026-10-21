import { Suspense } from 'react'
import type { Metadata } from 'next'

import { TestDrivePage } from '@/features/storefront/screens/TestDrivePage'

export const metadata: Metadata = { title: 'Test drive' }

export default function Page() {
  return <Suspense fallback={null}><TestDrivePage /></Suspense>
}
