'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { Make } from '@/features/storefront/lib/types'
import { formatPrice } from '../lib/format'
import { useStorefrontBusiness } from './StorefrontBusinessProvider'

const CONDITIONS = [
  { value: '', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'used', label: 'Pre-owned' },
  { value: 'certified', label: 'Certified' },
]

export function HeroSearch({ makes, years }: { makes: Make[]; years: number[] }) {
  const router = useRouter()
  const { currencyCode } = useStorefrontBusiness()
  const [condition, setCondition] = useState('')
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')
  const [priceMax, setPriceMax] = useState('')

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (condition) params.set('condition', condition)
    if (make) params.set('make', make)
    if (model) params.set('model', model)
    if (year) {
      params.set('yearMin', year)
      params.set('yearMax', year)
    }
    if (priceMax) params.set('priceMax', priceMax)
    const query = params.toString()
    router.push(query ? `/inventory?${query}` : '/inventory')
  }

  return (
    <form
      onSubmit={onSubmit}
      role="search"
      aria-label="Search inventory"
    >
      <div className="sf-track sf-track-block" role="group" aria-label="Condition">
        {CONDITIONS.map((option) => (
          <button
            key={option.value || 'all'}
            type="button"
            className="sf-pill"
            aria-pressed={condition === option.value}
            onClick={() => setCondition(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5">
        <div className="min-w-0">
          <label htmlFor="hero-make" className="sf-label">Make</label>
          <select id="hero-make" value={make} onChange={(e) => setMake(e.target.value)} className="sf-input">
            <option value="">Any make</option>
            {makes.map((m) => (
              <option key={m.id} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <label htmlFor="hero-model" className="sf-label">Model</label>
          <input
            id="hero-model"
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Any model"
            className="sf-input"
          />
        </div>

        <div className="min-w-0">
          <label htmlFor="hero-year" className="sf-label">Year</label>
          <select id="hero-year" value={year} onChange={(e) => setYear(e.target.value)} className="sf-input">
            <option value="">Any</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <label htmlFor="hero-price" className="sf-label">Max price</label>
          <select id="hero-price" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} className="sf-input">
            <option value="">No limit</option>
            {[15000, 20000, 25000, 30000, 40000, 50000, 75000].map((value) => (
              <option key={value} value={value}>
                {formatPrice(value, currencyCode)}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" className="sf-btn sf-btn-primary col-span-2 mt-1">
          <Search className="size-4" aria-hidden="true" />
          Search
        </button>
      </div>
    </form>
  )
}
