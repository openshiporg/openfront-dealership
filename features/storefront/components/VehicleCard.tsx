'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Check, Plus } from 'lucide-react'
import { Vehicle } from '@/features/storefront/lib/types'
import {
  addToComparison,
  isInComparison,
  removeFromComparison,
} from '@/features/storefront/lib/comparison'
import { formatMileage, formatPrice } from '../lib/format'
import { primaryVehicleImage, vehicleImageUrl } from '../lib/images'
import { vehicleConditionLabel, vehicleStatus } from '../lib/vehicleStatus'
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
  const name = `${vehicle.year} ${vehicle.make} ${vehicle.model}`
  const title = vehicle.trim ? `${name} ${vehicle.trim}` : name
  const status = vehicleStatus(vehicle.status)
  const href = `/inventory/${vehicle.id}`

  const toggleCompare = () => {
    if (comparing) {
      removeFromComparison(vehicle.id)
      setCompareFull(false)
      return
    }
    setCompareFull(!addToComparison(vehicle.id))
  }

  const compareButton = showCompareButton ? (
    <button
      type="button"
      onClick={toggleCompare}
      className="sf-pill"
      data-active={comparing ? 'true' : undefined}
      aria-pressed={comparing}
      aria-label={comparing ? `Remove ${title} from compare` : `Add ${title} to compare`}
    >
      {comparing ? <Check className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
      Compare
    </button>
  ) : null

  if (layout === 'feature') {
    return (
      <article className="sf-lift grid min-w-0 gap-5 md:grid-cols-[1.25fr_1fr] md:gap-8">
        <Link href={href} className="sf-photo block aspect-[4/3]" tabIndex={-1} aria-hidden="true">
          {imageUrl ? (
            <Image src={imageUrl} alt="" fill className="object-cover" sizes="(max-width: 768px) 100vw, 55vw" priority={priority} unoptimized />
          ) : (
            <VehiclePhotoPlaceholder />
          )}
          <span className="sf-chip sf-chip-dark absolute left-3 top-3">{vehicleConditionLabel(vehicle.condition)}</span>
        </Link>
        <div className="flex min-w-0 flex-col justify-end gap-5">
          <div className="min-w-0">
            <h3 className="sf-title-line">
              <span className="sf-dot" data-tone={status.tone} aria-hidden="true" />
              <Link href={href} className="sf-heading text-[length:var(--sf-text-xl)] hover:text-[var(--sf-accent)]">
                {name}
              </Link>
            </h3>
            <p className="sf-muted mt-1 pl-4 text-[length:var(--sf-text-sm)]">
              <span className="sr-only">{status.label}. </span>
              {vehicle.trim}
            </p>
          </div>
          <dl className="sf-spec">
            <div><dt>Mileage</dt><dd className="sf-figure">{formatMileage(vehicle.mileage)}</dd></div>
            <div><dt>Color</dt><dd>{vehicle.color || 'Not listed'}</dd></div>
            <div><dt>Stock</dt><dd className="sf-figure">{vehicle.stockNumber}</dd></div>
          </dl>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <p className="sf-price text-[length:var(--sf-text-2xl)]">{formatPrice(vehicle.price, currencyCode)}</p>
            <div className="sf-track">
              <Link href={href} className="sf-pill sf-pill-primary">View vehicle</Link>
              {compareButton}
            </div>
          </div>
          {compareFull && <p role="status" className="sf-muted text-[length:var(--sf-text-xs)]">Compare holds 4 vehicles.</p>}
          <PhotoAttribution src={imageUrl} />
        </div>
      </article>
    )
  }

  return (
    <article className="sf-lift flex h-full min-w-0 flex-col">
      <Link href={href} className="sf-photo block aspect-[4/3]" tabIndex={-1} aria-hidden="true">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            priority={priority}
            unoptimized
          />
        ) : (
          <VehiclePhotoPlaceholder />
        )}
        <span className="sf-chip sf-chip-dark absolute left-3 top-3">{vehicleConditionLabel(vehicle.condition)}</span>
      </Link>

      <div className="flex flex-1 flex-col pt-4">
        <h3 className="sf-title-line">
          <span className="sf-dot" data-tone={status.tone} aria-hidden="true" />
          <Link href={href} className="sf-heading min-w-0 text-[length:var(--sf-text-lg)] hover:text-[var(--sf-accent)]">
            {name}
          </Link>
        </h3>
        <p className="sf-muted mt-0.5 min-h-[1.5em] truncate pl-4 text-[length:var(--sf-text-sm)]">
          <span className="sr-only">{status.label}. </span>
          {vehicle.trim}
        </p>

        <div className="mt-3 flex items-baseline justify-between gap-3 pl-4">
          <p className="sf-price text-[length:var(--sf-text-xl)]">{formatPrice(vehicle.price, currencyCode)}</p>
          <p className="sf-figure sf-faint truncate text-[length:var(--sf-text-xs)]">{formatMileage(vehicle.mileage)}</p>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 pt-4 pl-4">
          <p className="sf-figure sf-faint min-w-0 truncate text-[length:var(--sf-text-xs)]">
            {vehicle.color ? `${vehicle.color} · ` : ''}#{vehicle.stockNumber}
          </p>
          {compareButton && <div className="sf-track shrink-0">{compareButton}</div>}
        </div>
        {compareFull && <p role="status" className="sf-muted mt-2 pl-4 text-[length:var(--sf-text-xs)]">Compare holds 4 vehicles.</p>}
        <div className="pl-4"><PhotoAttribution src={imageUrl} /></div>
      </div>
    </article>
  )
}
