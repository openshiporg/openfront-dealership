'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

const LINKS = [
  { href: '/account', label: 'Requests' },
  { href: '/account/vehicles', label: 'My vehicles' },
  { href: '/account/service', label: 'Service' },
  { href: '/account/profile', label: 'Profile' },
]

function isCurrent(pathname: string | null, href: string) {
  if (!pathname) return false
  if (href === '/account') return pathname === '/account' || pathname.startsWith('/account/requests')
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AccountNav({ children }: { children?: ReactNode }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Account" className="sf-track flex-wrap rounded-[var(--sf-radius-md)] sm:flex-nowrap sm:rounded-full">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="sf-pill min-h-11 px-5"
          aria-current={isCurrent(pathname, link.href) ? 'page' : undefined}
        >
          {link.label}
        </Link>
      ))}
      {children}
    </nav>
  )
}
