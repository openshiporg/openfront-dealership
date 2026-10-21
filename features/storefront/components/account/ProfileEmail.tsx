'use client'

import { updateCustomerEmail, type CustomerProfile } from '../../actions/account'
import { ProfileField } from './ProfileField'

export function ProfileEmail({ customer }: { customer: CustomerProfile }) {
  return (
    <ProfileField title="Email address" action={updateCustomerEmail}>
      <label htmlFor="profile-email" className="sf-eyebrow block">Email</label>
      <input id="profile-email" name="email" type="email" autoComplete="email" required defaultValue={customer.email || ''} className="sf-input min-h-11" />
    </ProfileField>
  )
}
