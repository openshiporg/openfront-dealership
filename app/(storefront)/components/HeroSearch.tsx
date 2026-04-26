'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Make } from '../lib/types'

interface HeroSearchProps {
  makes: Make[]
  years: number[]
}

export function HeroSearch({ makes, years }: HeroSearchProps) {
  const router = useRouter()
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()

    const params = new URLSearchParams()
    if (make) params.append('make', make)
    if (model) params.append('model', model)
    if (year) params.append('year', year)

    router.push(`/inventory?${params.toString()}`)
  }

  return (
    <form onSubmit={handleSearch} className="max-w-5xl mx-auto">
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Make Select */}
          <div>
            <label htmlFor="make" className="block text-sm font-medium text-slate-700 mb-2">
              Make
            </label>
            <select
              id="make"
              value={make}
              onChange={(e) => setMake(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-slate-900"
            >
              <option value="">All Makes</option>
              {makes.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Model Input */}
          <div>
            <label htmlFor="model" className="block text-sm font-medium text-slate-700 mb-2">
              Model
            </label>
            <input
              id="model"
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Any Model"
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-slate-900 placeholder-slate-400"
            />
          </div>

          {/* Year Select */}
          <div>
            <label htmlFor="year" className="block text-sm font-medium text-slate-700 mb-2">
              Year
            </label>
            <select
              id="year"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-slate-900"
            >
              <option value="">All Years</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Search Button */}
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}
