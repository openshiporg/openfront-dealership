'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { fetchGraphQL } from '@/features/storefront/lib/data/graphql-client'
import { GET_VEHICLES } from '@/features/storefront/lib/data/queries'
import { Vehicle } from '@/features/storefront/lib/types'
import { buildVehicleOrderBy, buildVehicleWhereInput } from '@/features/storefront/lib/data/vehicle-inventory'
import { INVENTORY_PAGE_SIZE, parseInventoryPage, resolveInventoryPage } from '@/features/storefront/lib/data/inventory-pagination'
import { Container } from '../components/Container'
import { VehicleCard } from '../components/VehicleCard'

export function InventoryPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [hydratedFromUrl, setHydratedFromUrl] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [invalidPage, setInvalidPage] = useState(false)
  const [pageNotice, setPageNotice] = useState<string | null>(null)
  const requestSequence = useRef(0)
  const lastWrittenQuery = useRef<string | null>(null)
  const searchParams = useSearchParams()
  const searchKey = searchParams?.toString() ?? ''
  const itemsPerPage = INVENTORY_PAGE_SIZE

  const [filters, setFilters] = useState({
    search: '',
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
    if (lastWrittenQuery.current === searchKey) return
    const params = new URLSearchParams(searchKey)
    const year = params.get('year') || ''
    setFilters({
      search: params.get('search') || '',
      make: params.get('make') || '',
      model: params.get('model') || '',
      yearMin: params.get('yearMin') || year,
      yearMax: params.get('yearMax') || year,
      priceMin: params.get('priceMin') || '',
      priceMax: params.get('priceMax') || '',
      mileageMax: params.get('mileageMax') || '',
      condition: params.get('condition') || '',
    })
    setSortBy(params.get('sort') || 'year-desc')
    const page = parseInventoryPage(params.get('page'))
    if (page.status === 'valid') {
      setCurrentPage(page.page)
      setInvalidPage(false)
    } else setInvalidPage(true)
    setPageNotice(null)
    setHydratedFromUrl(true)
  }, [searchKey])

  useEffect(() => {
    if (!hydratedFromUrl) return
    if (invalidPage) {
      requestSequence.current += 1
      setVehicles([])
      setTotalCount(0)
      setLoadError(null)
      setLoading(false)
      return
    }
    void loadVehicles()
  }, [filters, sortBy, currentPage, hydratedFromUrl, invalidPage])

  useEffect(() => {
    if (!hydratedFromUrl || invalidPage) return
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })
    if (sortBy !== 'year-desc') params.set('sort', sortBy)
    if (currentPage > 1) params.set('page', String(currentPage))
    const query = params.toString()
    lastWrittenQuery.current = query
    window.history.replaceState(null, '', query ? `/inventory?${query}` : '/inventory')
  }, [filters, sortBy, currentPage, hydratedFromUrl, invalidPage])

  const loadVehicles = async () => {
    const sequence = ++requestSequence.current
    let pageTransitionPending = false
    setLoading(true)
    setLoadError(null)

    const pageRequest = parseInventoryPage(String(currentPage))
    if (pageRequest.status !== 'valid') {
      if (sequence === requestSequence.current) {
        setVehicles([])
        setTotalCount(0)
        setInvalidPage(true)
        setLoading(false)
      }
      return
    }

    let where: ReturnType<typeof buildVehicleWhereInput>
    try {
      where = buildVehicleWhereInput(filters)
    } catch (error) {
      if (sequence === requestSequence.current) {
        setVehicles([])
        setTotalCount(0)
        setLoadError(error instanceof Error ? error.message : 'Inventory filters are invalid.')
        setLoading(false)
      }
      return
    }

    try {
      const orderBy = buildVehicleOrderBy(sortBy)
      const data = await fetchGraphQL<{ publicInventoryVehicles: { items: Vehicle[]; totalCount: number } }>(GET_VEHICLES, {
        where,
        orderBy,
        take: itemsPerPage,
        skip: pageRequest.skip,
      })
      if (sequence !== requestSequence.current) return

      const result = data.publicInventoryVehicles
      if (!result || !Array.isArray(result.items) || !Number.isSafeInteger(result.totalCount) || result.totalCount < 0) {
        throw new Error('Inventory response is incomplete.')
      }
      const resolution = resolveInventoryPage(currentPage, result.totalCount, result.items.length)
      if (resolution.status === 'invalid-response') throw new Error('Inventory page does not match its verified result count.')

      if (resolution.status === 'out-of-range') {
        pageTransitionPending = true
        setVehicles([])
        setTotalCount(result.totalCount)
        setPageNotice('That page is past the current results. Showing the last available page.')
        setCurrentPage(resolution.lastPage)
        return
      }

      if (resolution.status === 'empty') {
        setVehicles([])
        setTotalCount(0)
        if (resolution.resetToFirstPage) {
          pageTransitionPending = true
          setPageNotice('No matching vehicles were found. Returning to the first page.')
          setCurrentPage(1)
        } else {
          setPageNotice(null)
        }
        return
      }

      setVehicles(result.items)
      setTotalCount(result.totalCount)
    } catch {
      if (sequence === requestSequence.current) {
        setVehicles([])
        setTotalCount(0)
        setPageNotice(null)
        setLoadError('Inventory could not be loaded. Please try again.')
      }
    } finally {
      if (sequence === requestSequence.current && !pageTransitionPending) setLoading(false)
    }
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setCurrentPage(1)
    setInvalidPage(false)
    setPageNotice(null)
  }

  const clearFilters = () => {
    setFilters({
      search: '',
      make: '',
      model: '',
      yearMin: '',
      yearMax: '',
      priceMin: '',
      priceMax: '',
      mileageMax: '',
      condition: '',
    })
    setSortBy('year-desc')
    setCurrentPage(1)
    setInvalidPage(false)
    setPageNotice(null)
  }

  const goToPage = (page: number) => {
    setCurrentPage(page)
    setInvalidPage(false)
    setPageNotice(null)
  }

  const activeFilterCount =
    Object.values(filters).filter(Boolean).length + (sortBy !== 'year-desc' ? 1 : 0)
  const totalPages = Math.ceil(totalCount / itemsPerPage)
  const firstVisiblePage = Math.min(Math.max(1, currentPage - 2), Math.max(1, totalPages - 4))
  const visiblePageCount = Math.min(5, totalPages)
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 20 }, (_, i) => currentYear - i)

  return (
    <>
      <section style={{ background: 'var(--sf-paper-3)', color: 'var(--sf-accent-ink)' }}>
        <Container className="py-[var(--sf-space-xl)]">
          <p className="sf-eyebrow opacity-70 mb-2">Inventory</p>
          <h1 className="sf-display text-[length:var(--sf-text-display)]">On the lot</h1>
          <p className="mt-3 text-[var(--sf-text-md)] opacity-80 max-w-xl">
            {loading
              ? 'Loading vehicles…'
              : invalidPage
                ? 'Invalid inventory page'
                : loadError
                  ? 'Inventory results unavailable'
                  : `${totalCount} vehicle${totalCount === 1 ? '' : 's'} match your search`}
          </p>
        </Container>
      </section>

      <Container className="py-[var(--sf-space-lg)]">
        <div className="flex flex-col lg:flex-row gap-[var(--sf-space-lg)]">
          <aside className={`lg:w-72 shrink-0 ${filtersOpen ? 'block' : 'hidden lg:block'}`}>
            <div className="sf-card p-[var(--sf-space-md)] lg:sticky lg:top-28">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Refine</h2>
                <button type="button" onClick={clearFilters} className="text-[var(--sf-text-xs)] hover:text-[var(--sf-accent)]">
                  Reset
                </button>
              </div>

              <div className="space-y-4 text-[var(--sf-text-sm)]">
                <div>
                  <label htmlFor="inventory-search" className="sf-eyebrow block mb-2">Search</label>
                  <input
                    id="inventory-search"
                    type="search"
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    placeholder="Make, model or trim"
                    className="sf-input"
                  />
                </div>
                <div>
                  <label htmlFor="inventory-condition" className="sf-eyebrow block mb-2">Condition</label>
                  <select
                    id="inventory-condition"
                    value={filters.condition}
                    onChange={(e) => handleFilterChange('condition', e.target.value)}
                    className="sf-input"
                  >
                    <option value="">All</option>
                    <option value="new">New</option>
                    <option value="used">Used</option>
                    <option value="certified">Certified pre-owned</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="inventory-make" className="sf-eyebrow block mb-2">Make</label>
                  <input
                    id="inventory-make"
                    type="text"
                    value={filters.make}
                    onChange={(e) => handleFilterChange('make', e.target.value)}
                    placeholder="e.g. Toyota"
                    className="sf-input"
                  />
                </div>
                <div>
                  <label htmlFor="inventory-model" className="sf-eyebrow block mb-2">Model</label>
                  <input
                    id="inventory-model"
                    type="text"
                    value={filters.model}
                    onChange={(e) => handleFilterChange('model', e.target.value)}
                    placeholder="e.g. Camry"
                    className="sf-input"
                  />
                </div>
                <div>
                  <label htmlFor="inventory-year-min" className="sf-eyebrow block mb-2">Year</label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      id="inventory-year-min"
                      value={filters.yearMin}
                      onChange={(e) => handleFilterChange('yearMin', e.target.value)}
                      className="sf-input"
                      aria-label="Minimum year"
                    >
                      <option value="">Min</option>
                      {years.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                    <select
                      value={filters.yearMax}
                      onChange={(e) => handleFilterChange('yearMax', e.target.value)}
                      className="sf-input"
                      aria-label="Maximum year"
                    >
                      <option value="">Max</option>
                      {years.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label htmlFor="inventory-price-min" className="sf-eyebrow block mb-2">Price</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      id="inventory-price-min"
                      aria-label="Minimum price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={filters.priceMin}
                      onChange={(e) => handleFilterChange('priceMin', e.target.value)}
                      placeholder="Min"
                      className="sf-input"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={filters.priceMax}
                      onChange={(e) => handleFilterChange('priceMax', e.target.value)}
                      placeholder="Max"
                      className="sf-input"
                      aria-label="Maximum price"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="inventory-mileage-max" className="sf-eyebrow block mb-2">Max mileage</label>
                  <input
                    id="inventory-mileage-max"
                    type="number"
                    min="0"
                    step="1"
                    value={filters.mileageMax}
                    onChange={(e) => handleFilterChange('mileageMax', e.target.value)}
                    placeholder="Any"
                    className="sf-input"
                  />
                </div>
              </div>
            </div>
          </aside>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-[var(--sf-space-md)]">
              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                className="lg:hidden sf-btn sf-btn-ghost text-sm"
              >
                {filtersOpen ? 'Hide filters' : 'Show filters'}
              </button>
              <div className="flex items-center gap-2 ml-auto">
                <label htmlFor="sort" className="sf-eyebrow">
                  Sort
                </label>
                <select
                  id="sort"
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value)
                    setCurrentPage(1)
                    setInvalidPage(false)
                    setPageNotice(null)
                  }}
                  className="sf-input w-auto"
                >
                  <option value="year-desc">Year · newest</option>
                  <option value="year-asc">Year · oldest</option>
                  <option value="price-asc">Price · low to high</option>
                  <option value="price-desc">Price · high to low</option>
                  <option value="mileage-asc">Mileage · low to high</option>
                </select>
              </div>
            </div>

            {activeFilterCount > 0 && (
              <p className="text-[var(--sf-text-xs)] mb-4" style={{ color: 'var(--sf-ink-3)' }}>
                {activeFilterCount} active filter{activeFilterCount === 1 ? '' : 's'}
              </p>
            )}

            {pageNotice && !loading && !loadError && !invalidPage && (
              <p role="status" className="sf-card p-4 mb-[var(--sf-space-md)]">{pageNotice}</p>
            )}

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-[var(--sf-space-md)]">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="sf-card aspect-[4/5] sf-skeleton" aria-hidden />
                ))}
              </div>
            ) : invalidPage ? (
              <div className="sf-card p-[var(--sf-space-xl)] text-center">
                <p role="alert" className="text-[var(--sf-text-md)]">Page not found.</p>
                <button
                  type="button"
                  onClick={() => {
                    setInvalidPage(false)
                    setCurrentPage(1)
                    setPageNotice(null)
                  }}
                  className="mt-4 sf-btn sf-btn-primary"
                >
                  Return to first page
                </button>
              </div>
            ) : loadError ? (
              <div className="sf-card p-[var(--sf-space-xl)] text-center">
                <p role="alert" className="text-[var(--sf-text-md)]">
                  {loadError}
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  <button type="button" onClick={() => void loadVehicles()} className="sf-btn sf-btn-ghost">
                    Retry
                  </button>
                  <button type="button" onClick={clearFilters} className="sf-btn sf-btn-primary">
                    Clear filters
                  </button>
                </div>
              </div>
            ) : vehicles.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-[var(--sf-space-md)] min-w-0">
                  {vehicles.map((vehicle) => (
                    <VehicleCard key={vehicle.id} vehicle={vehicle} priority />
                  ))}
                </div>

                {totalPages > 1 && (
                  <nav className="mt-[var(--sf-space-xl)] flex justify-center gap-2 flex-wrap" aria-label="Pagination">
                    <button
                      type="button"
                      onClick={() => goToPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="sf-btn sf-btn-ghost text-sm"
                    >
                      Previous
                    </button>
                    {firstVisiblePage > 1 && <span className="px-2 self-center text-[var(--sf-ink-3)]">…</span>}
                    {Array.from({ length: visiblePageCount }, (_, i) => {
                      const page = firstVisiblePage + i
                      return (
                        <button
                          key={page}
                          type="button"
                          onClick={() => goToPage(page)}
                          aria-current={currentPage === page ? 'page' : undefined}
                          className={`sf-btn text-sm ${currentPage === page ? 'sf-btn-primary' : 'sf-btn-ghost'}`}
                        >
                          {page}
                        </button>
                      )
                    })}
                    {firstVisiblePage + visiblePageCount - 1 < totalPages && <span className="px-2 self-center text-[var(--sf-ink-3)]">…</span>}
                    <span className="self-center px-2 text-[var(--sf-ink-3)]" aria-live="polite">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => goToPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="sf-btn sf-btn-ghost text-sm"
                    >
                      Next
                    </button>
                  </nav>
                )}
              </>
            ) : (
              <div className="sf-card p-[var(--sf-space-xl)] text-center">
                <p className="text-[var(--sf-text-md)]" style={{ color: 'var(--sf-ink-2)' }}>
                  No vehicles match these filters.
                </p>
                <button type="button" onClick={clearFilters} className="mt-4 sf-btn sf-btn-primary">
                  Clear filters
                </button>
              </div>
            )}
          </div>
        </div>
      </Container>
    </>
  )
}
