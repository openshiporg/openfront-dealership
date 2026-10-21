'use client'

import { updateCustomerPhone, type CustomerProfile } from '../../actions/account'
import { ProfileField } from './ProfileField'

export function ProfilePhone({ customer }: { customer: CustomerProfile }) {
  return (
    <ProfileField title="Phone number" action={updateCustomerPhone}>
      <label htmlFor="profile-phone" className="sf-eyebrow block">Phone</label>
      <input id="profile-phone" name="phone" type="tel" autoComplete="tel" defaultValue={customer.phone || ''} className="sf-input min-h-11" />
    </ProfileField>
  )
}
