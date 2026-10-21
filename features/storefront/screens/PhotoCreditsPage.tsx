import { notFound } from 'next/navigation'

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
  if (!photos.length) notFound()

  return (
    <>
      <PageHeader
        eyebrow="Photo credits"
        title="Vehicle photography"
      />
      <Container className="max-w-3xl py-[var(--sf-space-2xl)]">
        <div className="sf-card space-y-8 p-[var(--sf-space-lg)] text-[var(--sf-text-sm)] leading-7">
          {photos.map((photo) => (
            <section key={photo.path}>
              <h2 className="sf-display mb-2 text-[length:var(--sf-text-xl)]">{photo.vehicle}</h2>
              <dl className="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-1">
                <dt className="text-[var(--sf-ink-3)]">Original</dt>
                <dd className="min-w-0 break-words">
                  <a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                    {photo.title}
                  </a>
                </dd>
                <dt className="text-[var(--sf-ink-3)]">Author</dt>
                <dd>{photo.author}</dd>
                <dt className="text-[var(--sf-ink-3)]">License</dt>
                <dd>
                  <a href={photo.licenseUrl} target="_blank" rel="license noopener noreferrer" className="underline underline-offset-2">
                    {photo.license}
                  </a>
                </dd>
                <dt className="text-[var(--sf-ink-3)]">Changes</dt>
                <dd>{photo.changes}</dd>
              </dl>
            </section>
          ))}
          <p className="border-t pt-5 text-[var(--sf-text-xs)] text-[var(--sf-ink-3)]">
            The modified photos are shared under the same license as their originals. The photographers do not endorse
            this dealership or its listings.
          </p>
        </div>
      </Container>
    </>
  )
}
