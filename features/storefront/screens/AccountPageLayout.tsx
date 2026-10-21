import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { getCustomer } from '../actions/account'
import { AccountLayout } from '../components/account/AccountLayout'

export const metadata: Metadata = {
  title: 'Account',
}

export async function AccountPageLayout({
  dashboard,
  login,
}: {
  dashboard?: ReactNode
  login?: ReactNode
}) {
  const customer = await getCustomer()

  return <AccountLayout signedIn={Boolean(customer)}>{customer ? dashboard : login}</AccountLayout>
}
