'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { fetchGraphQL } from '@/features/storefront/lib/data/graphql-client'
import { GET_VEHICLE_BY_ID } from '@/features/storefront/lib/data/queries'
import { Vehicle } from '@/features/storefront/lib/types'
import {
  getComparisonVehicles,
  removeFromComparison,
  clearComparison,
} from '@/features/storefront/lib/comparison'
import { Button } from '../components/Button'
import { Container } from '../components/Container'
import { PageHeader } from '../components/PageHeader'
import { useStorefrontBusiness } from '../components/StorefrontBusinessProvider'
import { VehiclePhotoPlaceholder } from '../components/VehiclePhotoPlaceholder'
import { formatPrice, formatMileage, vehicleTitle } from '../lib/format'
import { vehicleImageUrl } from '../lib/images'
import { partitionSavedVehicleResults } from '../lib/data/compare-inventory'

const COMPARISON_FIELDS: {
  label: string
  key: string
  format: (v: Vehicle, currencyCode?: string) => string
  highlight: boolean
}[] = [
  { label: 'Price', key: 'price', format: (v, currencyCode) => formatPrice(v.price, currencyCode), highlight: true },
  { label: 'Year', key: 'year', format: (v) => String(v.year), highlight: false },
  { label: 'Make', key: 'make', format: (v) => v.make, highlight: false },
  { label: 'Model', key: 'model', format: (v) => v.model, highlight: false },
  { label: 'Trim', key: 'trim', format: (v) => v.trim || '—', highlight: false },
  { label: 'Mileage', key: 'mileage', format: (v) => formatMileage(v.mileage), highlight: true },
  { label: 'Condition', key: 'condition', format: (v) => v.condition || '—', highlight: false },
  { label: 'Color', key: 'color', format: (v) => v.color || '—', highlight: false },
  { label: 'MPG city', key: 'mpgCity', format: (v) => String(v.features?.mpgCity ?? '—'), highlight: true },
  { label: 'MPG highway', key: 'mpgHighway', format: (v) => String(v.features?.mpgHighway ?? '—'), highlight: true },
  { label: 'VIN', key: 'vin', format: (v) => v.vin, highlight: false },
  { label: 'Stock #', key: 'stockNumber', format: (v) => v.stockNumber, highlight: false },
]

function numericValue(field: (typeof COMPARISON_FIELDS)[number], v: Vehicle): number | null {
  const formatted = field.format(v)
  const num = parseFloat(formatted.replace(/[^0-9.-]/g, ''))
  return isNaN(num) ? null : num
}

function bestValueClass(
  field: (typeof COMPARISON_FIELDS)[number],
  vehicle: Vehicle,
  all: Vehicle[]
): string {
  if (!field.highlight) return ''
  const values = all.map((v) => numericValue(field, v)).filter((v): v is number => v !== null)
  if (values.length <= 1) return ''
  const current = numericValue(field, vehicle)
  if (current === null) return ''
  if (field.key === 'price' || field.key === 'mileage') {
    return current === Math.min(...values) ? 'sf-best' : ''
  }
  if (field.key.includes('mpg')) {
    return current === Math.max(...values) ? 'sf-best' : ''
  }
  return ''
}

export function ComparePage() {
  const { currencyCode } = useStorefrontBusiness()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [savedIds, setSavedIds] = useState<string[]>([])
  const [unavailableIds, setUnavailableIds] = useState<string[]>([])
  const [loadError, setLoadError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadComparisonVehicles()
    const handler = () => loadComparisonVehicles()
    window.addEventListener('comparison-updated', handler)
    return () => window.removeEventListener('comparison-updated', handler)
  }, [])

  const loadComparisonVehicles = async () => {
    setLoading(true)
    setLoadError(false)
    const ids = getComparisonVehicles()
    setSavedIds(ids)
    if (ids.length === 0) {
      setVehicles([])
      setUnavailableIds([])
      setLoading(false)
      return
    }
    try {
      const results = await Promise.all(ids.map((id) => fetchGraphQL<{ publicInventoryVehicle: Vehicle | null }>(GET_VEHICLE_BY_ID, { id })))
      const resolved = partitionSavedVehicleResults<Vehicle>(ids, results)
      setVehicles(resolved.vehicles)
      setUnavailableIds(resolved.unavailableIds)
    } catch (error) {
      console.error('Error loading comparison vehicles:', error)
      setVehicles([])
      setUnavailableIds([])
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  const handleClearAll = () => {
    clearComparison()
  }

  if (loading) {
    return (
      <>
        <PageHeader eyebrow="Compare" title="Compare vehicles" />
        <Container className="py-[var(--sf-space-2xl)]">
          <div className="sf-skeleton h-64 rounded-[var(--sf-radius-md)]" />
        </Container>
      </>
    )
  }

  if (loadError) {
    return (
      <>
        <PageHeader eyebrow="Compare" title="Compare vehicles" />
        <Container className="py-[var(--sf-space-2xl)] max-w-lg text-center">
          <p role="alert" className="text-[var(--sf-text-md)] mb-6" style={{ color: 'var(--sf-ink-2)' }}>
            These vehicles couldn&apos;t be loaded. Please try again.
          </p>
          <div className="flex justify-center gap-3">
            <button type="button" onClick={() => void loadComparisonVehicles()} className="sf-btn sf-btn-ghost">
              Retry
            </button>
            <Button href="/inventory">Browse inventory</Button>
          </div>
        </Container>
      </>
    )
  }

  if (savedIds.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Compare" title="No vehicles to compare" />
        <Container className="py-[var(--sf-space-2xl)] max-w-lg text-center">
          <p className="text-[var(--sf-text-md)] mb-6" style={{ color: 'var(--sf-ink-2)' }}>
            You haven&apos;t added any vehicles to compare yet.
          </p>
          <Button href="/inventory">Browse inventory</Button>
        </Container>
      </>
    )
  }

  if (vehicles.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Compare" title="Vehicles no longer available" />
        <Container className="py-[var(--sf-space-2xl)] max-w-lg text-center">
          <p className="text-[var(--sf-text-md)] mb-6" style={{ color: 'var(--sf-ink-2)' }}>
            These vehicles are no longer available.
          </p>
          <div className="space-y-3 mb-6">
            {unavailableIds.map((id) => (
              <div key={id} className="sf-card flex items-center justify-between gap-4 p-4 text-left">
                <span>Vehicle no longer available</span>
                <button type="button" onClick={() => removeFromComparison(id)} className="sf-btn sf-btn-ghost text-sm">
                  Remove
                </button>
              </div>
            ))}
          </div>
          <Button href="/inventory">Browse inventory</Button>
        </Container>
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Compare"
        title="Compare vehicles"
        description={`Comparing ${vehicles.length} vehicle${vehicles.length !== 1 ? 's' : ''}`}
      />

      <Container className="py-[var(--sf-space-2xl)]">
        {unavailableIds.length > 0 && (
          <div className="sf-card p-4 mb-[var(--sf-space-md)]" role="status">
            <p className="mb-3">Some vehicles are no longer available.</p>
            <div className="space-y-2">
              {unavailableIds.map((id) => (
                <div key={id} className="flex items-center justify-between gap-4 border-t pt-2" style={{ borderColor: 'var(--sf-rule)' }}>
                  <span>Vehicle no longer available</span>
                  <button type="button" onClick={() => removeFromComparison(id)} className="sf-btn sf-btn-ghost text-sm">
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex justify-end gap-3 mb-[var(--sf-space-md)]">
          <button onClick={handleClearAll} className="sf-btn sf-btn-ghost text-sm">
            Clear all
          </button>
          <Button href="/inventory" variant="ghost" className="text-sm">
            Add more vehicles
          </Button>
        </div>

        <div className="sf-card overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ background: 'var(--sf-paper-2)' }}>
                <th className="p-4 text-left sf-eyebrow sticky left-0 z-10 align-bottom" style={{ background: 'var(--sf-paper-2)' }}>
                  Feature
                </th>
                {vehicles.map((vehicle) => (
                  <th key={vehicle.id} className="p-4 min-w-[240px] align-bottom">
                    <div className="relative aspect-[16/10] mb-3 bg-[var(--sf-paper-2)] overflow-hidden">
                      {vehicleImageUrl(vehicle.images?.[0]) ? (
                        <Image
                          src={vehicleImageUrl(vehicle.images?.[0])!}
                          alt={vehicleTitle(vehicle)}
                          width={300}
                          height={190}
                          className="object-cover w-full h-full"
                          unoptimized
                        />
                      ) : (
                        <VehiclePhotoPlaceholder />
                      )}
                    </div>
                    <h3 className="sf-display text-[length:var(--sf-text-lg)] leading-tight">{vehicleTitle(vehicle)}</h3>
                    <p className="text-[var(--sf-text-sm)] mt-1" style={{ color: 'var(--sf-ink-2)' }}>
                      {formatPrice(vehicle.price, currencyCode)}
                    </p>
                    <button
                      onClick={() => removeFromComparison(vehicle.id)}
                      className="text-[var(--sf-text-xs)] mt-2 hover:underline"
                      style={{ color: 'var(--sf-ink-3)' }}
                    >
                      Remove
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_FIELDS.map((field, idx) => (
                <tr
                  key={field.key}
                  className="border-t"
                  style={{ borderColor: 'var(--sf-rule)', background: idx % 2 === 0 ? 'var(--sf-paper)' : 'var(--sf-paper-2)' }}
                >
                  <td
                    className="p-4 font-semibold text-[var(--sf-text-sm)] sticky left-0 z-10"
                    style={{ background: 'inherit', borderRight: '1px solid var(--sf-rule)' }}
                  >
                    {field.label}
                    {field.highlight && (
                      <span className="ml-2" style={{ color: 'var(--sf-accent)' }}>★</span>
                    )}
                  </td>
                  {vehicles.map((vehicle) => (
                    <td
                      key={vehicle.id}
                      className={`p-4 text-center text-[var(--sf-text-sm)] ${bestValueClass(field, vehicle, vehicles)}`}
                    >
                      {field.format(vehicle, currencyCode)}
                    </td>
                  ))}
                </tr>
              ))}

              <tr className="border-t" style={{ borderColor: 'var(--sf-rule)' }}>
                <td
                  className="p-4 font-semibold text-[var(--sf-text-sm)] sticky left-0 z-10 align-top"
                  style={{ background: 'var(--sf-paper)', borderRight: '1px solid var(--sf-rule)' }}
                >
                  Description
                </td>
                {vehicles.map((vehicle) => (
                  <td key={vehicle.id} className="p-4 text-[var(--sf-text-sm)] align-top" style={{ color: 'var(--sf-ink-2)' }}>
                    {vehicle.description || 'No description available'}
                  </td>
                ))}
              </tr>

              <tr className="border-t" style={{ borderColor: 'var(--sf-rule)', background: 'var(--sf-paper-2)' }}>
                <td
                  className="p-4 font-semibold text-[var(--sf-text-sm)] sticky left-0 z-10"
                  style={{ background: 'var(--sf-paper-2)', borderRight: '1px solid var(--sf-rule)' }}
                >
                  Actions
                </td>
                {vehicles.map((vehicle) => (
                  <td key={vehicle.id} className="p-4">
                    <div className="flex flex-col gap-2">
                      <Link href={`/inventory/${vehicle.id}`} className="sf-btn sf-btn-primary text-xs">
                        View details
                      </Link>
                      <Link
                        href={`/test-drive?vehicleId=${vehicle.id}`}
                        className="sf-btn sf-btn-ghost text-xs"
                      >
                        Test drive
                      </Link>
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Container>
    </>
  )
}
