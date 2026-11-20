import { Suspense } from 'react'
import type { Metadata } from 'next'

import { ResetPasswordPage } from '@/features/storefront/screens/ResetPasswordPage'
import { loadStorefrontBusiness } from '@/features/storefront/lib/data/storefront-business'

// Nested under the @login/@dashboard slot the account template is not applied, so name the store here.
export async function generateMetadata(): Promise<Metadata> {
  const settings = await loadStorefrontBusiness()
  return { title: { absolute: settings.status === 'error' ? 'Reset password' : `Reset password | ${settings.business.shortName}` } }
}

export default function Page() {
  return <Suspense fallback={null}><ResetPasswordPage /></Suspense>
}
