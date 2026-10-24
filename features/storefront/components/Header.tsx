'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowUpRight, Menu, Phone, Search, SquareStack, UserRound, X } from 'lucide-react'
import { getComparisonVehicles } from '@/features/storefront/lib/comparison'
import { isEscapeKey, restoreFocusAfterClose } from '../lib/dialogAccessibility'
import { Container } from './Container'
import { StoreLogo } from '@/features/platform/store-settings/components/StoreLogo'
import { useStorefrontBusiness } from './StorefrontBusinessProvider'

const NAV = [
  { href: '/inventory', label: 'Inventory' },
  { href: '/financing', label: 'Financing' },
  { href: '/trade-in', label: 'Trade-in' },
  { href: '/test-drive', label: 'Test drive' },
  { href: '/service', label: 'Service' },
]

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function Header() {
  const router = useRouter()
  const pathname = usePathname() || '/'
  const business = useStorefrontBusiness()
  const [savedCount, setSavedCount] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const sync = () => setSavedCount(getComparisonVehicles().length)
    sync()
    window.addEventListener('comparison-updated', sync)
    return () => window.removeEventListener('comparison-updated', sync)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    router.push(`/inventory?search=${encodeURIComponent(q)}`)
    setQuery('')
    setMenuOpen(false)
  }

  const closeMenuFromKeyboard = () => {
    setMenuOpen(false)
    restoreFocusAfterClose(menuButtonRef.current)
  }

  const handleHeaderKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (!menuOpen || !isEscapeKey(event.key)) return
    event.preventDefault()
    event.stopPropagation()
    closeMenuFromKeyboard()
  }

  const hasPhone = Boolean(business.phoneHref && business.phoneDisplay)

  return (
    <header className="sticky top-0 z-50" onKeyDown={handleHeaderKeyDown}>
      <div className="sf-band hidden text-[length:var(--sf-text-xs)] sm:block">
        <Container className="flex items-center gap-5 py-2">
          {business.addressLine1 && (
            <span className="hidden min-w-0 truncate md:inline" style={{ color: 'var(--sf-on-dark-2)' }}>
              {[business.addressLine1, business.addressLine2].filter(Boolean).join(', ')}
            </span>
          )}
          {business.hoursMonFri && (
            <span className="hidden min-w-0 truncate lg:inline" style={{ color: 'var(--sf-on-dark-2)' }}>
              {business.hoursMonFri}
            </span>
          )}
          <span className="flex-1" />
          {business.directionsHref && (
            <a href={business.directionsHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 whitespace-nowrap transition-opacity hover:opacity-80">
              Directions
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </a>
          )}
          <Link href="/contact" className="whitespace-nowrap transition-opacity hover:opacity-80">
            Contact
          </Link>
          {hasPhone && (
            <a href={business.phoneHref} className="sf-figure whitespace-nowrap font-medium transition-opacity hover:opacity-80">
              {business.phoneDisplay}
            </a>
          )}
        </Container>
      </div>

      <div
        className="border-b backdrop-blur-md"
        style={{ background: 'oklch(0.987 0.002 255 / 0.9)', borderColor: 'var(--sf-rule)' }}
      >
        <Container className="flex h-16 items-center gap-4 md:h-[4.5rem]">
          <Link href="/" className="flex min-w-0 flex-1 items-center gap-2.5 xl:flex-initial" aria-label={`${business.shortName} home`} title={business.shortName}>
            <StoreLogo svg={business.logoIcon} color={business.logoColor} className="size-7 shrink-0" />
            <span className="sf-heading min-w-[6rem] truncate whitespace-nowrap text-[1rem] md:text-[1.1875rem]">{business.shortName}</span>
          </Link>

          <nav className="ml-4 hidden shrink-0 items-center gap-1 xl:flex" aria-label="Primary">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className="relative whitespace-nowrap rounded-full px-3 py-2 text-[length:var(--sf-text-sm)] font-semibold transition-colors"
                  style={{ color: active ? 'var(--sf-ink)' : 'var(--sf-ink-2)' }}
                >
                  {item.label}
                  {active && (
                    <span aria-hidden="true" className="absolute inset-x-3 -bottom-[0.95rem] h-0.5 rounded-full" style={{ background: 'var(--sf-accent)' }} />
                  )}
                </Link>
              )
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <form onSubmit={onSearch} className="relative hidden md:block" role="search">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: 'var(--sf-ink-3)' }} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Make, model, stock #"
                className="sf-input sf-input-icon w-48 rounded-full 2xl:w-60"
                aria-label="Search inventory"
              />
            </form>

            <Link
              href="/compare"
              className="relative grid size-11 place-items-center rounded-full transition-colors hover:bg-[var(--sf-paper-2)]"
              aria-label={`Compare vehicles${savedCount ? `, ${savedCount} selected` : ''}`}
            >
              <SquareStack className="size-5" aria-hidden="true" />
              {savedCount > 0 && (
                <span
                  className="sf-figure absolute right-1 top-1 grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full px-1 text-[10px] font-bold"
                  style={{ background: 'var(--sf-accent)', color: 'var(--sf-accent-ink)' }}
                >
                  {savedCount}
                </span>
              )}
            </Link>

            <Link
              href="/account"
              aria-current={isActive(pathname, '/account') ? 'page' : undefined}
              className="hidden size-11 place-items-center rounded-full transition-colors hover:bg-[var(--sf-paper-2)] sm:grid"
              aria-label="Account"
            >
              <UserRound className="size-5" aria-hidden="true" />
            </Link>

            {hasPhone && (
              <a href={business.phoneHref} className="grid size-11 place-items-center rounded-full transition-colors hover:bg-[var(--sf-paper-2)] sm:hidden" aria-label={`Call ${business.phoneDisplay}`}>
                <Phone className="size-5" aria-hidden="true" />
              </a>
            )}

            <Link href="/inventory" className="sf-btn sf-btn-primary sf-btn-sm ml-1 hidden whitespace-nowrap md:inline-flex xl:hidden">
              Shop inventory
            </Link>

            <button
              ref={menuButtonRef}
              type="button"
              className="grid size-11 place-items-center rounded-full transition-colors hover:bg-[var(--sf-paper-2)] xl:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-controls="storefront-mobile-menu"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            >
              {menuOpen ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
            </button>
          </div>
        </Container>
      </div>

      {menuOpen && (
        <div
          id="storefront-mobile-menu"
          className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-b xl:hidden"
          style={{ background: 'var(--sf-paper)', borderColor: 'var(--sf-rule)', boxShadow: 'var(--sf-shadow-float)' }}
        >
          <Container className="flex flex-col py-4">
            <form onSubmit={onSearch} className="relative mb-3 md:hidden" role="search">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: 'var(--sf-ink-3)' }} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Make, model, stock #"
                className="sf-input sf-input-icon rounded-full"
                aria-label="Search inventory"
              />
            </form>
            <nav aria-label="Mobile">
              {[...NAV, { href: '/compare', label: 'Compare' }, { href: '/contact', label: 'Contact' }, { href: '/account', label: 'Account' }].map((item) => {
                const active = isActive(pathname, item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className="sf-heading flex min-h-12 items-center justify-between border-b text-[length:var(--sf-text-lg)] last:border-0"
                    style={{ borderColor: 'var(--sf-rule)', color: active ? 'var(--sf-accent)' : 'var(--sf-ink)' }}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
            {(hasPhone || business.directionsHref) && (
              <div className="sf-track sf-track-block mt-4">
                {hasPhone && (
                  <a href={business.phoneHref} className="sf-pill sf-pill-raised">
                    <Phone className="size-4" aria-hidden="true" />
                    Call
                  </a>
                )}
                {business.directionsHref && (
                  <a href={business.directionsHref} target="_blank" rel="noreferrer" className="sf-pill sf-pill-raised">
                    Directions
                    <ArrowUpRight className="size-4" aria-hidden="true" />
                  </a>
                )}
              </div>
            )}
          </Container>
        </div>
      )}
    </header>
  )
}
