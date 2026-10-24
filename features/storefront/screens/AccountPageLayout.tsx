import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { getCustomer } from '../actions/account'
import { AccountLayout } from '../components/account/AccountLayout'
import { loadStorefrontBusiness } from '../lib/data/storefront-business'

// A plain string title here would drop the storefront's "%s | <store>" template for every account
// page ("Sign in" with no store name), so the template is restated for this subtree.
export async function generateMetadata(): Promise<Metadata> {
  const settings = await loadStorefrontBusiness()
  if (settings.status === 'error') return { title: 'Account' }
  return { title: { default: 'Account', template: `%s | ${settings.business.shortName}` } }
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
