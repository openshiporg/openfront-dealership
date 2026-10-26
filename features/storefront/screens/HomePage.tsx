import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { fetchGraphQL } from '@/features/storefront/lib/data/graphql-client'
import { GET_MAKES, GET_VEHICLES, GET_VEHICLES_COUNT } from '@/features/storefront/lib/data/queries'
import { Make, Vehicle } from '@/features/storefront/lib/types'
import { Container } from '../components/Container'
import { HeroSearch } from '../components/HeroSearch'
import { HomeContactPanel } from '../components/HomeContactPanel'
import { VehicleCard } from '../components/VehicleCard'
import { vehicleConditionLabel } from '../lib/vehicleStatus'
import { formatPrice, vehicleTitle } from '../lib/format'
import { primaryVehicleImage, vehicleImageUrl } from '../lib/images'
import { loadHomeQuery, selectHomeFeaturedVehicles, selectHomeInventoryCount } from '../lib/data/home-inventory'
import { loadStorefrontBusiness } from '../lib/data/storefront-business'
import { createStorefrontBusiness } from '../lib/business'

async function getFeaturedVehicles() {
  return loadHomeQuery(
    () => fetchGraphQL<unknown>(GET_VEHICLES, {
      where: { status: { equals: 'available' } },
      orderBy: [{ year: 'desc' }],
      take: 6,
    }),
    selectHomeFeaturedVehicles<Vehicle>,
  )
}

async function getInventoryCount() {
  return loadHomeQuery(
    () => fetchGraphQL<unknown>(GET_VEHICLES_COUNT, {
      where: { status: { equals: 'available' } },
    }),
    selectHomeInventoryCount,
  )
}

async function getMakes(): Promise<Make[]> {
  try {
    const data = await fetchGraphQL<{ makes: Make[] }>(GET_MAKES, {})
    return data.makes ?? []
  } catch {
    return []
  }
}

// Doors on the directory sign besides Sales (which carries the live search).
const DOORS = [
  { href: '/test-drive', label: 'Test drive', action: 'Pick a time' },
  { href: '/trade-in', label: 'Trade-in', action: 'Value your vehicle' },
  { href: '/financing', label: 'Financing', action: 'Estimate a payment' },
  { href: '/service', label: 'Service', action: 'Book an appointment' },
]

export async function HomePage() {
  const [featured, inventoryCount, makes, settings] = await Promise.all([
    getFeaturedVehicles(),
    getInventoryCount(),
    getMakes(),
    loadStorefrontBusiness(),
  ])
  const business = settings.status === 'ready' ? settings.business : createStorefrontBusiness()
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 30 }, (_, i) => currentYear + 1 - i)
  const vehicles = featured.status === 'ready' ? featured.value : []
  // The hero shows the first listed vehicle that has a photo; with none, the hero is a single column.
  const leadEntry = vehicles
    .map((vehicle) => ({ vehicle, image: vehicleImageUrl(primaryVehicleImage(vehicle.images)) }))
    .find((entry) => entry.image)
  const lead = leadEntry?.vehicle
  const leadImage = leadEntry?.image ?? null
  const count = inventoryCount.status === 'ready' ? inventoryCount.value : null

  return (
    <>
      <section className="pb-[var(--sf-space-xl)] pt-4 md:pb-[var(--sf-space-2xl)] md:pt-8">
        <Container className="grid gap-4 md:gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="sf-band sf-sign flex min-w-0 flex-col px-5 pb-2 pt-6 md:px-8 md:pt-8">
            <h1 className="sf-display max-w-[16ch] text-[length:var(--sf-text-display)]">
              {business.homepageTitle || business.fullName}
            </h1>
            {business.homepageDescription && (
              <p className="mt-4 max-w-md text-[length:var(--sf-text-md)]" style={{ color: 'var(--sf-on-dark-2)' }}>
                {business.homepageDescription}
              </p>
            )}

            <div className="sf-sign-row mt-7 pb-5 pt-4">
              <div className="mb-3 flex items-baseline justify-between gap-4">
                <h2 className="sf-heading text-[length:var(--sf-text-xl)]">Sales</h2>
                <Link href="/inventory" className="sf-link inline-flex items-center gap-1 text-[length:var(--sf-text-sm)]">
                  {count !== null ? (
                    <>
                      <span className="sf-figure">{new Intl.NumberFormat('en-US').format(count)}</span> on the lot
                    </>
                  ) : (
                    'All inventory'
                  )}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
              <HeroSearch makes={makes} years={years} />
            </div>

            <ul>
              {DOORS.map((door) => (
                <li key={door.href} className="sf-sign-row">
                  <Link href={door.href} className="sf-sign-door group">
                    <span className="sf-heading w-28 shrink-0 text-[length:var(--sf-text-lg)]">{door.label}</span>
                    <span className="min-w-0 flex-1 text-[length:var(--sf-text-sm)]" style={{ color: 'var(--sf-on-dark-2)' }}>{door.action}</span>
                    <ArrowRight className="sf-sign-arrow size-5 shrink-0" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {lead && leadImage ? (
            <Link href={`/inventory/${lead.id}`} className="sf-lead-frame group flex min-h-[18rem] flex-col sm:min-h-[24rem]">
              <Image src={leadImage} alt={vehicleTitle(lead)} fill priority unoptimized sizes="(min-width: 1024px) 46rem, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.02]" />
              <span className="relative m-3 self-start md:m-4">
                <span className="sf-stall">#{lead.stockNumber}</span>
              </span>
              <span className="relative mt-auto flex flex-wrap items-end justify-between gap-x-6 gap-y-1 border-t px-4 py-3 md:px-5" style={{ background: 'var(--sf-paper)', borderColor: 'var(--sf-rule)' }}>
                <span className="min-w-0">
                  <span className="sf-eyebrow block">{vehicleConditionLabel(lead.condition)}</span>
                  <span className="sf-heading block text-[length:var(--sf-text-lg)]">{vehicleTitle(lead)}</span>
                </span>
                <span className="sf-price text-[length:var(--sf-text-2xl)]">{formatPrice(lead.price, business.currencyCode)}</span>
              </span>
            </Link>
          ) : null}
        </Container>
      </section>

      <section className="pb-[var(--sf-space-xl)] md:pb-[var(--sf-space-2xl)]">
        <Container>
          <div className="mb-6 flex items-end justify-between gap-4 border-b pb-3" style={{ borderColor: 'var(--sf-rule-strong)' }}>
            <h2 className="sf-display text-[length:var(--sf-text-2xl)]">On the lot</h2>
            <Link href="/inventory" className="sf-link inline-flex shrink-0 items-center gap-1 text-[length:var(--sf-text-sm)]">
              All inventory
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>

          {featured.status === 'unavailable' ? (
            <div className="sf-well flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between" role="alert">
              <p className="sf-title-line font-semibold">
                <span className="sf-dot" data-tone="bad" aria-hidden="true" />
                Inventory couldn&apos;t be loaded.
              </p>
              <Link href="/" prefetch={false} className="sf-btn sf-btn-ghost sf-btn-sm">Retry</Link>
            </div>
          ) : vehicles.length > 0 ? (
            <div className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {vehicles.map((vehicle, index) => (
                <VehicleCard key={vehicle.id} vehicle={vehicle} priority={index < 3} />
              ))}
            </div>
          ) : (
            <div className="sf-well flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="sf-title-line font-semibold">
                <span className="sf-dot" aria-hidden="true" />
                No vehicles listed
              </p>
              <Link href="/contact" className="sf-btn sf-btn-ghost sf-btn-sm">Contact sales</Link>
            </div>
          )}
        </Container>
      </section>

      <HomeContactPanel />
    </>
  )
}
