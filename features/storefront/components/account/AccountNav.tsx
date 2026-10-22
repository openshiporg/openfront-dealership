'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

const LINKS = [
  { href: '/account', label: 'Overview' },
  { href: '/account/profile', label: 'Profile' },
]

export function AccountNav({ children }: { children?: ReactNode }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Account" className="sf-track">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="sf-pill min-h-11 px-5"
          aria-current={pathname === link.href ? 'page' : undefined}
        >
          {link.label}
        </Link>
      ))}
      {children}
    </nav>
  )
}
