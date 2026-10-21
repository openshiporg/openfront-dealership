'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Make } from '@/features/storefront/lib/types'

export function HeroSearch({ makes, years }: { makes: Make[]; years: number[] }) {
  const router = useRouter()
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (make) params.set('make', make)
    if (model) params.set('model', model)
    if (year) {
      params.set('yearMin', year)
      params.set('yearMax', year)
    }
    router.push(`/inventory?${params.toString()}`)
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_0.8fr_auto] gap-3 p-[var(--sf-space-md)] sf-card"
    >
      <div>
        <label htmlFor="hero-make" className="sf-eyebrow block mb-2">
          Make
        </label>
        <select id="hero-make" value={make} onChange={(e) => setMake(e.target.value)} className="sf-input">
          <option value="">Any make</option>
          {makes.map((m) => (
            <option key={m.id} value={m.name}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="hero-model" className="sf-eyebrow block mb-2">
          Model
        </label>
        <input
          id="hero-model"
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="Any model"
          className="sf-input"
        />
      </div>

      <div>
        <label htmlFor="hero-year" className="sf-eyebrow block mb-2">
          Year
        </label>
        <select id="hero-year" value={year} onChange={(e) => setYear(e.target.value)} className="sf-input">
          <option value="">Any year</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-end">
        <button type="submit" className="sf-btn sf-btn-primary w-full sm:w-auto">
          Search lot
        </button>
      </div>
    </form>
  )
}
