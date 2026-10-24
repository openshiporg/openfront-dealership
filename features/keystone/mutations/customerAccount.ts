import { requiredText, validEmail } from './submissionUtils'

// Adapted from the canonical User/account boundary: customer registration never
// accepts role, membership, staff flags, or an existing CRM identity to claim.
export async function registerCustomerAccount(_root: unknown, { name, email, password }: { name: string; email: string; password: string }, context: any) {
  if (context.session?.itemId) throw new Error('Sign out before creating an account')
  const cleanName = requiredText(name, 'Name', 200)
  const cleanEmail = validEmail(email).toLowerCase()
  // Raw User creation remains staff-only; the User password field validates and hashes the password.
  const user = await context.sudo().query.User.createOne({
    data: { name: cleanName, email: cleanEmail, password, onboardingStatus: 'dismissed' }, query: 'id',
  })
  return { id: user.id }
}

export function requestingAccountId(context: any): string | null {
  return context.session?.listKey === 'User' && typeof context.session.itemId === 'string' ? context.session.itemId : null
}

// Account history and every customer-scoped read live in customerRecords.ts, behind the
// ownership boundary in customerOwnership.ts. Never use submitted email/phone or a guessed
// customerId to retrieve history.
