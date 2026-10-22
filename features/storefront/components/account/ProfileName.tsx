'use client'

import { updateCustomerName, type CustomerProfile } from '../../actions/account'
import { ProfileField } from './ProfileField'

export function ProfileName({ customer }: { customer: CustomerProfile }) {
  return (
    <ProfileField title="Name" action={updateCustomerName}>
      <div>
        <label htmlFor="profile-name" className="sf-label">Full name</label>
        <input id="profile-name" name="name" autoComplete="name" required maxLength={200} defaultValue={customer.name || ''} className="sf-input" />
      </div>
    </ProfileField>
  )
}
