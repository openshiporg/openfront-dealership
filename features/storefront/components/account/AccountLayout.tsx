import type { ReactNode } from 'react'
import { LogOut } from 'lucide-react'

import { signOutCustomer } from '../../actions/account'
import { Container } from '../Container'
import { AccountNav } from './AccountNav'

export function AccountLayout({ signedIn, children }: { signedIn: boolean; children: ReactNode }) {
  if (!signedIn) {
    return (
      <Container className="flex min-h-[70dvh] items-center justify-center py-[var(--sf-space-xl)] md:py-[var(--sf-space-2xl)]">
        {children}
      </Container>
    )
  }

  return (
    <Container className="sf-section">
      <div className="mb-[var(--sf-space-lg)]">
        <AccountNav>
          <form action={signOutCustomer} className="contents">
            <button type="submit" className="sf-pill min-h-11 px-4">
              <LogOut className="size-4" aria-hidden="true" />
              Sign out
            </button>
          </form>
        </AccountNav>
      </div>
      <div className="min-w-0">{children}</div>
    </Container>
  )
}
