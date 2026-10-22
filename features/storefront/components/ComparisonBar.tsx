'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clearComparison, getComparisonCount } from '@/features/storefront/lib/comparison'

export function ComparisonBar() {
  const [count, setCount] = useState(0)
  const pathname = usePathname()

  useEffect(() => {
    const sync = () => setCount(getComparisonCount())
    sync()
    window.addEventListener('comparison-updated', sync)
    return () => window.removeEventListener('comparison-updated', sync)
  }, [])

  if (count === 0 || pathname === '/compare') return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-14 z-50 flex justify-center px-3 md:bottom-5">
      <div
        className="sf-band pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-full py-1.5 pl-5 pr-1.5"
        style={{ boxShadow: 'var(--sf-shadow-float)' }}
        role="region"
        aria-label="Compare"
      >
        <p className="min-w-0 flex-1 truncate text-[var(--sf-text-sm)]">
          <span className="sf-figure font-semibold">{count}</span>
          <span style={{ color: 'var(--sf-on-dark-2)' }}> of 4 selected</span>
        </p>
        <div className="sf-track shrink-0">
          <button type="button" onClick={() => clearComparison()} className="sf-pill">
            Clear
          </button>
          <Link href="/compare" className="sf-pill sf-pill-primary">
            Compare
          </Link>
        </div>
      </div>
    </div>
  )
}
