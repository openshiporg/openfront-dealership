import { notFound } from 'next/navigation'

import { getCustomer } from '../actions/account'
import { ProfileEmail } from '../components/account/ProfileEmail'
import { ProfileName } from '../components/account/ProfileName'
import { ProfilePassword } from '../components/account/ProfilePassword'
import { ProfilePhone } from '../components/account/ProfilePhone'

export async function AccountProfilePage() {
  const customer = await getCustomer()
  if (!customer) notFound()

  return (
    <section>
      <header className="mb-8 border-b pb-6" style={{ borderColor: 'var(--sf-rule)' }}>
        <h1 className="sf-display text-[length:var(--sf-text-2xl)]">Profile</h1>
      </header>
      <div className="space-y-4">
        <ProfileName customer={customer} />
        <ProfileEmail customer={customer} />
        <ProfilePhone customer={customer} />
        <ProfilePassword />
      </div>
    </section>
  )
}
