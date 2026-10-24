import type { Metadata } from 'next'

import { AccountRequestDetailPage } from '@/features/storefront/screens/AccountRequestDetailPage'

export const metadata: Metadata = { title: 'Request' }

type Props = { params: Promise<{ ref: string }> }

export default async function Page({ params }: Props) {
  const { ref } = await params
  return <AccountRequestDetailPage refParam={ref} />
}
