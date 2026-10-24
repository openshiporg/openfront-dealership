import type { Metadata } from 'next'

import { AccountServiceOrderPage } from '@/features/storefront/screens/AccountServiceOrderPage'

export const metadata: Metadata = { title: 'Repair order' }

type Props = { params: Promise<{ id: string }> }

export default async function Page({ params }: Props) {
  const { id } = await params
  return <AccountServiceOrderPage id={id} />
}
