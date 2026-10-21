'use client'

import { updateCustomerPassword } from '../../actions/account'
import { ProfileField } from './ProfileField'

export function ProfilePassword() {
  return (
    <ProfileField title="Password" action={updateCustomerPassword}>
      <label htmlFor="profile-password" className="sf-eyebrow block">New password</label>
      <input id="profile-password" name="password" type="password" autoComplete="new-password" required minLength={8} className="sf-input min-h-11" />
      <label htmlFor="profile-confirm-password" className="sf-eyebrow block">Confirm new password</label>
      <input id="profile-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} className="sf-input min-h-11" />
    </ProfileField>
  )
}
