'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Vehicle } from '@/features/storefront/lib/types'
import {
  addToComparison,
  isInComparison,
  removeFromComparison,
} from '@/features/storefront/lib/comparison'
import { formatMileage, formatPrice, vehicleTitle } from '../lib/format'
import { primaryVehicleImage, vehicleImageUrl } from '../lib/images'
import { PhotoAttribution } from './PhotoAttribution'
import { useStorefrontBusiness } from './StorefrontBusinessProvider'
import { VehiclePhotoPlaceholder } from './VehiclePhotoPlaceholder'

interface VehicleCardProps {
  vehicle: Vehicle
  showCompareButton?: boolean
  layout?: 'grid' | 'feature'
  priority?: boolean
}

export function VehicleCard({
  vehicle,
  showCompareButton = true,
  layout = 'grid',
  priority = false,
}: VehicleCardProps) {
  const [comparing, setComparing] = useState(false)
  const [compareFull, setCompareFull] = useState(false)
  const { currencyCode } = useStorefrontBusiness()

  useEffect(() => {
    setComparing(isInComparison(vehicle.id))
    const onUpdate = () => setComparing(isInComparison(vehicle.id))
    window.addEventListener('comparison-updated', onUpdate)
    return () => window.removeEventListener('comparison-updated', onUpdate)
  }, [vehicle.id])

  const imageUrl = vehicleImageUrl(primaryVehicleImage(vehicle.images))
  const title = vehicleTitle(vehicle)

  const toggleCompare = () => {
    if (comparing) {
      removeFromComparison(vehicle.id)
      setCompareFull(false)
      return
    }
    setCompareFull(!addToComparison(vehicle.id))
  }

  const conditionLabel =
    vehicle.condition === 'certified'
      ? 'Certified'
      : vehicle.condition === 'new'
        ? 'New'
        : 'Pre-owned'

  if (layout === 'feature') {
    return (
      <article className="sf-card grid md:grid-cols-[1.15fr_1fr] min-w-0 overflow-hidden">
        <Link href={`/inventory/${vehicle.id}`} className="relative block aspect-[4/3] md:aspect-auto md:min-h-[22rem] bg-[var(--sf-paper-2)]">
          {imageUrl ? (
            <Image src={imageUrl} alt={title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 55vw" priority={priority} unoptimized />
          ) : (
            <VehiclePhotoPlaceholder />
          )}
        </Link>
        <div className="p-[var(--sf-space-lg)] flex flex-col justify-between gap-[var(--sf-space-md)]">
          <div>
            <p className="sf-eyebrow mb-2">{conditionLabel} · Stock {vehicle.stockNumber}</p>
            <h3 className="sf-display text-[length:var(--sf-text-xl)]">
              <Link href={`/inventory/${vehicle.id}`} className="hover:text-[var(--sf-accent)] transition-colors">
                {title}
              </Link>
            </h3>
            <p className="mt-3 text-[var(--sf-text-sm)]" style={{ color: 'var(--sf-ink-2)' }}>
              {formatMileage(vehicle.mileage)} · {vehicle.color}
            </p>
            <PhotoAttribution src={imageUrl} className="mt-2" />
            {compareFull && <p role="status" className="mt-2 text-[var(--sf-text-xs)]" style={{ color: 'var(--sf-ink-2)' }}>You can compare up to 4 vehicles at a time.</p>}
          </div>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <p className="sf-display text-[length:var(--sf-text-2xl)]" style={{ color: 'var(--sf-accent)' }}>
              {formatPrice(vehicle.price, currencyCode)}
            </p>
            <div className="flex gap-2">
              <Link href={`/inventory/${vehicle.id}`} className="sf-btn sf-btn-primary text-sm">
                View details
              </Link>
              {showCompareButton && (
                <button type="button" onClick={toggleCompare} className="sf-btn sf-btn-ghost text-sm" aria-pressed={comparing}>
                  {comparing ? 'Comparing' : 'Compare'}
                </button>
              )}
            </div>
          </div>
        </div>
      </article>
    )
  }

  return (
    <article className="sf-card flex flex-col min-w-0 overflow-hidden h-full">
      <Link href={`/inventory/${vehicle.id}`} className="relative block aspect-[16/10] bg-[var(--sf-paper-2)]">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            priority={priority}
            unoptimized
          />
        ) : (
          <VehiclePhotoPlaceholder />
        )}
        <span
          className="absolute top-3 left-3 px-2 py-1 text-[10px] font-semibold tracking-wide uppercase"
          style={{ background: 'var(--sf-paper-3)', color: 'var(--sf-accent-ink)' }}
        >
          {conditionLabel}
        </span>
      </Link>

      <div className="p-[var(--sf-space-md)] flex flex-col flex-1 gap-[var(--sf-space-sm)]">
        <div className="flex-1">
          <h3 className="font-semibold text-[var(--sf-text-md)] leading-snug">
            <Link href={`/inventory/${vehicle.id}`} className="hover:text-[var(--sf-accent)] transition-colors">
              {title}
            </Link>
          </h3>
          <p className="mt-1 text-[var(--sf-text-xs)]" style={{ color: 'var(--sf-ink-3)' }}>
            {formatMileage(vehicle.mileage)} · {vehicle.color}
          </p>
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t" style={{ borderColor: 'var(--sf-rule)' }}>
          <span className="font-semibold text-[var(--sf-text-lg)]" style={{ color: 'var(--sf-accent)' }}>
            {formatPrice(vehicle.price, currencyCode)}
          </span>
          <div className="flex gap-2">
            <Link href={`/inventory/${vehicle.id}`} className="sf-btn sf-btn-primary text-xs px-3 py-2">
              Details
            </Link>
            {showCompareButton && (
              <button type="button" onClick={toggleCompare} className="sf-btn sf-btn-ghost text-xs px-3 py-2" aria-pressed={comparing} aria-label={comparing ? 'Remove from compare' : 'Add to compare'}>
                {comparing ? '✓' : '+'}
              </button>
            )}
          </div>
        </div>
        {compareFull && <p role="status" className="text-[var(--sf-text-xs)]" style={{ color: 'var(--sf-ink-2)' }}>You can compare up to 4 vehicles at a time.</p>}
        <PhotoAttribution src={imageUrl} />
      </div>
    </article>
  )
}
