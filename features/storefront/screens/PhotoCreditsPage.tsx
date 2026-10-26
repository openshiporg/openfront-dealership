import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

import { Container } from '../components/Container'
import { PageHeader } from '../components/PageHeader'
import { openfrontClient } from '../lib/config'
import { GET_VEHICLES } from '../lib/data/queries'
import { vehicleImageUrl } from '../lib/images'
import type { Vehicle } from '../lib/types'
import { photoAttributionFor, type PhotoAttribution } from '../lib/photoAttribution'

async function listedPhotoAttributions(): Promise<PhotoAttribution[]> {
  try {
    const data = await openfrontClient.request<{ publicInventoryVehicles: { items: Vehicle[] } }>(GET_VEHICLES, {
      where: { status: { equals: 'available' } },
      take: 100,
    })
    const credits = new Map<string, PhotoAttribution>()
    for (const vehicle of data.publicInventoryVehicles?.items ?? []) {
      for (const image of vehicle.images ?? []) {
        const photo = photoAttributionFor(vehicleImageUrl(image))
        if (photo) credits.set(photo.path, photo)
      }
    }
    return Array.from(credits.values())
  } catch {
    return []
  }
}

export async function PhotoCreditsPage() {
  const photos = await listedPhotoAttributions()

  if (!photos.length) {
    return (
      <>
        <PageHeader title="Vehicle photography" />
        <Container className="py-[var(--sf-space-xl)] md:py-[var(--sf-space-2xl)]">
          <div className="sf-well flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="sf-title-line font-semibold">
              <span className="sf-dot" aria-hidden="true" />
              No attributed photos listed
            </p>
            <Link href="/inventory" className="sf-btn sf-btn-ghost sf-btn-sm min-h-10">Inventory</Link>
          </div>
        </Container>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Vehicle photography"
        description={`${photos.length} ${photos.length === 1 ? 'photo' : 'photos'} credited`}
      />
      <Container className="py-[var(--sf-space-xl)] md:py-[var(--sf-space-2xl)]">
        <ul className="grid gap-x-12 md:grid-cols-2">
          {photos.map((photo) => (
            <li key={photo.path} className="border-t py-6" style={{ borderColor: 'var(--sf-rule)' }}>
              <h2 className="sf-heading text-[length:var(--sf-text-lg)]">{photo.vehicle}</h2>
              <dl className="mt-4 grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-[length:var(--sf-text-sm)]">
                <dt className="sf-muted pt-0.5 font-semibold">Original</dt>
                <dd className="min-w-0">
                  <a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer" className="sf-link inline-flex items-start gap-1 break-words">
                    <span className="min-w-0">{photo.title}</span>
                    <ArrowUpRight className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  </a>
                </dd>
                <dt className="sf-muted pt-0.5 font-semibold">Author</dt>
                <dd className="min-w-0 break-words">{photo.author}</dd>
                <dt className="sf-muted pt-0.5 font-semibold">License</dt>
                <dd className="min-w-0">
                  <a href={photo.licenseUrl} target="_blank" rel="license noopener noreferrer" className="sf-link inline-flex items-start gap-1">
                    <span className="min-w-0">{photo.license}</span>
                    <ArrowUpRight className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  </a>
                </dd>
                <dt className="sf-muted pt-0.5 font-semibold">Changes</dt>
                <dd className="sf-muted min-w-0 break-words">{photo.changes}</dd>
              </dl>
            </li>
          ))}
        </ul>
        <p className="sf-faint mt-4 max-w-2xl border-t pt-6 text-[length:var(--sf-text-xs)] leading-relaxed" style={{ borderColor: 'var(--sf-rule)' }}>
          The modified photos are shared under the same license as their originals. The photographers do not endorse
          this dealership or its listings.
        </p>
      </Container>
    </>
  )
}
