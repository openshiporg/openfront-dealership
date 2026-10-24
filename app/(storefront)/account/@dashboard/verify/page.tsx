import type { Metadata } from 'next'

import { AccountVerifyEmailPage } from '@/features/storefront/screens/AccountVerifyEmailPage'

export const metadata: Metadata = { title: 'Verify email' }

type Props = { searchParams: Promise<{ token?: string | string[] }> }

export default async function Page({ searchParams }: Props) {
  const { token } = await searchParams
  return <AccountVerifyEmailPage token={typeof token === 'string' && token ? token : null} />
}
