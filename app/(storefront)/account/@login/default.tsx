import type { Metadata } from 'next'

import { LoginPage } from '@/features/storefront/screens/LoginPage'

export const metadata: Metadata = { title: 'Sign in' }

export default function Default() {
  return <LoginPage />
}
