'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getComparisonCount, clearComparison } from '../lib/comparison'

export function ComparisonBar() {
  const [count, setCount] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    updateCount()

    const handleUpdate = () => {
      updateCount()
    }

    window.addEventListener('comparison-updated', handleUpdate)
    return () => window.removeEventListener('comparison-updated', handleUpdate)
  }, [])

  const updateCount = () => {
    const newCount = getComparisonCount()
    setCount(newCount)
    setIsVisible(newCount > 0)
  }

  const handleClear = () => {
    if (confirm('Clear all vehicles from comparison?')) {
      clearComparison()
    }
  }

  if (!isVisible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-blue-600 text-white shadow-2xl z-50 border-t-4 border-blue-700">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span className="font-semibold">
                {count} vehicle{count !== 1 ? 's' : ''} selected
              </span>
            </div>
            <span className="text-sm opacity-90">
              {count < 4 ? `Add up to ${4 - count} more` : 'Maximum reached'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleClear}
              className="text-sm text-white hover:text-blue-200 transition-colors"
            >
              Clear All
            </button>
            <Link
              href="/compare"
              className="bg-white text-blue-600 px-6 py-2 rounded-md font-semibold hover:bg-blue-50 transition-colors"
            >
              Compare Now
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
