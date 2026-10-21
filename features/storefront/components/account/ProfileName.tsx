'use client'

import { updateCustomerName, type CustomerProfile } from '../../actions/account'
import { ProfileField } from './ProfileField'

export function ProfileName({ customer }: { customer: CustomerProfile }) {
  return (
    <ProfileField title="Name" action={updateCustomerName}>
      <label htmlFor="profile-name" className="sf-eyebrow block">Full name</label>
      <input id="profile-name" name="name" autoComplete="name" required maxLength={200} defaultValue={customer.name || ''} className="sf-input min-h-11" />
    </ProfileField>
  )
}
