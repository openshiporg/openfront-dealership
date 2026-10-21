import { hasAnyMembershipPermission, type DealershipTenancySession } from '../tenancy'

export type PasswordResetPath = '/account/reset' | '/dashboard/reset'

export function passwordResetPath(account: DealershipTenancySession['data'] | null): PasswordResetPath {
  const session = account ? { itemId: '', listKey: 'User', data: account } : undefined
  return hasAnyMembershipPermission(session, 'canAccessDashboard') ? '/dashboard/reset' : '/account/reset'
}
