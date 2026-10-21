import Link from 'next/link'
import type { ReactNode } from 'react'

import { signOutCustomer } from '../../actions/account'
import { Container } from '../Container'

export function AccountLayout({ signedIn, children }: { signedIn: boolean; children: ReactNode }) {
  if (!signedIn) {
    return <Container className="py-[var(--sf-space-2xl)] flex justify-center">{children}</Container>
  }

  return (
    <Container className="py-[var(--sf-space-2xl)]">
      <div className="grid gap-[var(--sf-space-xl)] md:grid-cols-[12rem_1fr]">
        <nav aria-label="Account" className="flex flex-row flex-wrap gap-2 md:flex-col md:items-start">
          <Link href="/account" className="inline-flex min-h-11 items-center hover:text-[var(--sf-accent)]">Overview</Link>
          <Link href="/account/profile" className="inline-flex min-h-11 items-center hover:text-[var(--sf-accent)]">Profile</Link>
          <form action={signOutCustomer}>
            <button type="submit" className="inline-flex min-h-11 items-center hover:text-[var(--sf-accent)]">Sign out</button>
          </form>
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </Container>
  )
}
