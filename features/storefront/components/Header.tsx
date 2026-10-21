'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
  { href: '/account', label: 'Account' },
]

export function Header() {
  const router = useRouter()
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

  return (
    <header
      className="sticky top-0 z-50 border-b"
      onKeyDown={handleHeaderKeyDown}
      style={{ background: 'var(--sf-paper)', borderColor: 'var(--sf-rule)' }}
    >
      <div
        className="hidden sm:block text-[var(--sf-text-xs)]"
        style={{ background: 'var(--sf-paper-3)', color: 'oklch(0.82 0.02 85)' }}
      >
        <Container className="flex items-center justify-between gap-4 py-2">
          {business.phoneHref && business.phoneDisplay ? (
            <a href={business.phoneHref} className="whitespace-nowrap hover:opacity-80 transition-opacity">
              {business.phoneDisplay}
            </a>
          ) : null}
          {business.hoursMonFri && (
            <span className="hidden md:inline truncate opacity-80">{business.hoursMonFri}</span>
          )}
          <Link href="/contact" className="whitespace-nowrap hover:opacity-80 transition-opacity">
            Contact
          </Link>
        </Container>
      </div>

      <Container className="flex items-center justify-between gap-4 py-4">
        <Link href="/" className="sf-display flex min-w-0 shrink items-center gap-2.5 text-[length:var(--sf-text-xl)] leading-none">
          <StoreLogo svg={business.logoIcon} color={business.logoColor} className="size-7" />
          <span className="truncate">{business.shortName}</span>
        </Link>

        <nav className="hidden lg:flex items-center gap-8 text-[var(--sf-text-sm)]">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hover:text-[var(--sf-accent)] transition-colors"
              style={{ color: 'var(--sf-ink-2)' }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <form onSubmit={onSearch} className="hidden md:block">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search inventory"
              className="sf-input w-44 lg:w-52"
              aria-label="Search inventory"
            />
          </form>

          <Link
            href="/compare"
            className="relative p-2 rounded-[var(--sf-radius-sm)] hover:bg-[var(--sf-paper-2)] transition-colors"
            aria-label={`Compare vehicles${savedCount ? `, ${savedCount} selected` : ''}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
              <rect x="9" y="3" width="6" height="4" rx="1" />
            </svg>
            {savedCount > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-5 h-5 px-1 text-[10px] font-bold flex items-center justify-center rounded-full"
                style={{ background: 'var(--sf-accent)', color: 'var(--sf-accent-ink)' }}
              >
                {savedCount}
              </span>
            )}
          </Link>

          <button
            ref={menuButtonRef}
            type="button"
            className="lg:hidden p-2"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls="storefront-mobile-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              {menuOpen ? (
                <path d="M6 6l12 12M18 6L6 18" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>
      </Container>

      {menuOpen && (
        <div id="storefront-mobile-menu" className="lg:hidden border-t" style={{ borderColor: 'var(--sf-rule)' }}>
          <Container className="py-4 flex flex-col gap-1">
            <form onSubmit={onSearch} className="mb-3 md:hidden">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search inventory"
                className="sf-input"
                aria-label="Search inventory"
              />
            </form>
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="py-3 text-[var(--sf-text-md)] border-b last:border-0"
                style={{ borderColor: 'var(--sf-rule)', color: 'var(--sf-ink)' }}
              >
                {item.label}
              </Link>
            ))}
          </Container>
        </div>
      )}
    </header>
  )
}
