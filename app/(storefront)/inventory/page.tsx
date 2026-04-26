'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { fetchGraphQL } from '../lib/graphql-client'
import { GET_VEHICLES, GET_VEHICLES_COUNT } from '../lib/queries'
import { Vehicle } from '../lib/types'
import { VehicleCard } from '../components/VehicleCard'

export default function InventoryPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 12

  // Filter state
  const [filters, setFilters] = useState({
    make: '',
    model: '',
    yearMin: '',
    yearMax: '',
    priceMin: '',
    priceMax: '',
    mileageMax: '',
    condition: '',
  })

  const [sortBy, setSortBy] = useState('year-desc')

  useEffect(() => {
    loadVehicles()
  }, [filters, sortBy, currentPage])

  const loadVehicles = async () => {
    setLoading(true)
    try {
      // Build where clause
      const where: any = {
        AND: [
          { status: { equals: 'available' } }
        ]
      }

      if (filters.make) {
        where.AND.push({ make: { contains: filters.make, mode: 'insensitive' } })
      }
      if (filters.model) {
        where.AND.push({ model: { contains: filters.model, mode: 'insensitive' } })
      }
      if (filters.yearMin) {
        where.AND.push({ year: { gte: parseInt(filters.yearMin) } })
      }
      if (filters.yearMax) {
        where.AND.push({ year: { lte: parseInt(filters.yearMax) } })
      }
      if (filters.priceMin) {
        where.AND.push({ price: { gte: parseFloat(filters.priceMin) } })
      }
      if (filters.priceMax) {
        where.AND.push({ price: { lte: parseFloat(filters.priceMax) } })
      }
      if (filters.mileageMax) {
        where.AND.push({ mileage: { lte: parseInt(filters.mileageMax) } })
      }
      if (filters.condition) {
        where.AND.push({ condition: { equals: filters.condition } })
      }

      // Build orderBy clause
      let orderBy: any[] = []
      switch (sortBy) {
        case 'price-asc':
          orderBy = [{ price: 'asc' }]
          break
        case 'price-desc':
          orderBy = [{ price: 'desc' }]
          break
        case 'mileage-asc':
          orderBy = [{ mileage: 'asc' }]
          break
        case 'year-desc':
          orderBy = [{ year: 'desc' }]
          break
        case 'year-asc':
          orderBy = [{ year: 'asc' }]
          break
        default:
          orderBy = [{ year: 'desc' }]
      }

      // Fetch vehicles
      const data = await fetchGraphQL<{ vehicles: Vehicle[] }>(GET_VEHICLES, {
        where,
        orderBy,
        take: itemsPerPage,
        skip: (currentPage - 1) * itemsPerPage
      })

      // Fetch count
      const countData = await fetchGraphQL<{ vehiclesCount: number }>(GET_VEHICLES_COUNT, {
        where
      })

      setVehicles(data.vehicles || [])
      setTotalCount(countData.vehiclesCount || 0)
    } catch (error) {
      console.error('Error loading vehicles:', error)
      setVehicles([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setCurrentPage(1) // Reset to first page when filters change
  }

  const clearFilters = () => {
    setFilters({
      make: '',
      model: '',
      yearMin: '',
      yearMax: '',
      priceMin: '',
      priceMax: '',
      mileageMax: '',
      condition: '',
    })
    setCurrentPage(1)
  }

  const totalPages = Math.ceil(totalCount / itemsPerPage)
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 20 }, (_, i) => currentYear - i)

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold">Browse Inventory</h1>
          <p className="text-slate-600 mt-2">Find your perfect vehicle from our extensive selection</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Filters Sidebar */}
          {filtersOpen && (
            <aside className="w-80 flex-shrink-0">
              <div className="bg-white rounded-lg shadow p-4 sticky top-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-lg">Filters</h2>
                  <button
                    onClick={clearFilters}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Clear All
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Condition */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Condition</label>
                    <select
                      value={filters.condition}
                      onChange={(e) => handleFilterChange('condition', e.target.value)}
                      className="w-full border rounded-md p-2 text-sm"
                    >
                      <option value="">All Conditions</option>
                      <option value="new">New</option>
                      <option value="used">Used</option>
                      <option value="certified">Certified Pre-Owned</option>
                    </select>
                  </div>

                  {/* Make */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Make</label>
                    <input
                      type="text"
                      value={filters.make}
                      onChange={(e) => handleFilterChange('make', e.target.value)}
                      placeholder="Enter make (e.g., Toyota)"
                      className="w-full border rounded-md p-2 text-sm"
                    />
                  </div>

                  {/* Model */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Model</label>
                    <input
                      type="text"
                      value={filters.model}
                      onChange={(e) => handleFilterChange('model', e.target.value)}
                      placeholder="Enter model (e.g., Camry)"
                      className="w-full border rounded-md p-2 text-sm"
                    />
                  </div>

                  {/* Year Range */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Year</label>
                    <div className="flex gap-2">
                      <select
                        value={filters.yearMin}
                        onChange={(e) => handleFilterChange('yearMin', e.target.value)}
                        className="flex-1 border rounded-md p-2 text-sm"
                      >
                        <option value="">Min</option>
                        {years.map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                      <select
                        value={filters.yearMax}
                        onChange={(e) => handleFilterChange('yearMax', e.target.value)}
                        className="flex-1 border rounded-md p-2 text-sm"
                      >
                        <option value="">Max</option>
                        {years.map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Price Range */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Price</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={filters.priceMin}
                        onChange={(e) => handleFilterChange('priceMin', e.target.value)}
                        placeholder="Min"
                        className="flex-1 border rounded-md p-2 text-sm"
                      />
                      <input
                        type="number"
                        value={filters.priceMax}
                        onChange={(e) => handleFilterChange('priceMax', e.target.value)}
                        placeholder="Max"
                        className="flex-1 border rounded-md p-2 text-sm"
                      />
                    </div>
                  </div>

                  {/* Mileage */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Maximum Mileage</label>
                    <input
                      type="number"
                      value={filters.mileageMax}
                      onChange={(e) => handleFilterChange('mileageMax', e.target.value)}
                      placeholder="Any mileage"
                      className="w-full border rounded-md p-2 text-sm"
                    />
                  </div>
                </div>
              </div>
            </aside>
          )}

          {/* Results Area */}
          <div className="flex-1">
            {/* Results Header */}
            <div className="bg-white rounded-lg shadow p-4 mb-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setFiltersOpen(!filtersOpen)}
                    className="text-sm text-slate-600 hover:text-slate-800 flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    {filtersOpen ? 'Hide Filters' : 'Show Filters'}
                  </button>
                  <span className="text-slate-600 text-sm">
                    Showing {vehicles.length} of {totalCount} vehicles
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-600">Sort by:</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="border rounded-md p-2 text-sm"
                  >
                    <option value="year-desc">Year: Newest First</option>
                    <option value="year-asc">Year: Oldest First</option>
                    <option value="price-asc">Price: Low to High</option>
                    <option value="price-desc">Price: High to Low</option>
                    <option value="mileage-asc">Mileage: Low to High</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Vehicle Grid */}
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="text-slate-600 mt-4">Loading vehicles...</p>
              </div>
            ) : vehicles.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {vehicles.map((vehicle) => (
                    <VehicleCard key={vehicle.id} vehicle={vehicle} />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-8 flex justify-center">
                    <nav className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 border rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>

                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const pageNum = i + 1
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`px-4 py-2 border rounded-md ${
                              currentPage === pageNum
                                ? 'bg-blue-600 text-white'
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        )
                      })}

                      {totalPages > 5 && <span className="px-2">...</span>}

                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 border rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </nav>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 bg-white rounded-lg shadow">
                <svg className="w-16 h-16 mx-auto text-slate-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-slate-600 text-lg mb-4">No vehicles match your criteria</p>
                <button
                  onClick={clearFilters}
                  className="text-blue-600 hover:text-blue-800 font-semibold"
                >
                  Clear filters and try again
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
