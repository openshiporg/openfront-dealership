import { Suspense } from 'react'
import type { Metadata } from 'next'

import { ResetPasswordPage } from '@/features/storefront/screens/ResetPasswordPage'

export const metadata: Metadata = { title: 'Reset password' }

export default function Page() {
  return <Suspense fallback={null}><ResetPasswordPage /></Suspense>
}
