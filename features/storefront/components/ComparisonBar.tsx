'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { clearComparison, getComparisonCount } from '@/features/storefront/lib/comparison'
import { Container } from './Container'

export function ComparisonBar() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const sync = () => setCount(getComparisonCount())
    sync()
    window.addEventListener('comparison-updated', sync)
    return () => window.removeEventListener('comparison-updated', sync)
  }, [])

  if (count === 0) return null

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-50 border-t"
      style={{ background: 'var(--sf-paper-3)', borderColor: 'var(--sf-rule)', color: 'var(--sf-accent-ink)' }}
    >
      <Container className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-[var(--sf-text-sm)]">
          <span className="font-semibold">{count}</span> vehicle{count !== 1 ? 's' : ''} to compare
          {count < 4 && <span className="opacity-70"> · add up to {4 - count} more</span>}
        </p>
        <div className="flex shrink-0 gap-2 sm:mr-36">
          <button
            type="button"
            onClick={() => clearComparison()}
            className="sf-btn sf-btn-ghost text-sm"
            style={{ color: 'var(--sf-accent-ink)', borderColor: 'oklch(0.5 0.02 85)' }}
          >
            Clear
          </button>
          <Link href="/compare" className="sf-btn sf-btn-primary text-sm">
            Compare
          </Link>
        </div>
      </Container>
    </div>
  )
}
