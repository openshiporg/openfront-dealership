import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, KeyRound, Landmark, Repeat2, Wrench } from 'lucide-react'
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

const LANES = [
  { href: '/financing', label: 'Financing', action: 'Get pre-qualified', icon: Landmark },
  { href: '/trade-in', label: 'Trade-in', action: 'Value your vehicle', icon: Repeat2 },
  { href: '/test-drive', label: 'Test drive', action: 'Pick a time', icon: KeyRound },
  { href: '/service', label: 'Service', action: 'Book an appointment', icon: Wrench },
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
      <section className="sf-band relative overflow-hidden">
        <Container className={`relative grid gap-10 pb-28 pt-10 md:pb-36 md:pt-16 ${lead && leadImage ? 'lg:grid-cols-[1fr_1.05fr] lg:items-end lg:gap-14' : ''}`}>
          <div className="min-w-0">
            {count !== null && (
              <p className="sf-title-line sf-eyebrow">
                <span className="sf-dot" data-tone={count > 0 ? 'ok' : 'idle'} aria-hidden="true" />
                <span className="sf-figure">{new Intl.NumberFormat('en-US').format(count)}</span> in stock
              </p>
            )}
            <h1 className={`sf-display mt-4 text-[length:var(--sf-text-display)] ${lead && leadImage ? 'max-w-[15ch]' : 'max-w-[22ch]'}`}>
              {business.homepageTitle || business.fullName}
            </h1>
            {business.homepageDescription && (
              <p className="mt-5 max-w-md text-[var(--sf-text-md)]" style={{ color: 'var(--sf-on-dark-2)' }}>
                {business.homepageDescription}
              </p>
            )}
            <div className="sf-track mt-8">
              <Link href="/inventory" className="sf-pill sf-pill-primary">Shop inventory</Link>
              <Link href="/test-drive" className="sf-pill">Book a test drive</Link>
            </div>
          </div>

          {lead && leadImage && (
            <Link href={`/inventory/${lead.id}`} className="group relative hidden min-w-0 lg:block">
              <div className="relative aspect-[16/10] overflow-hidden rounded-[var(--sf-radius-lg)]" style={{ background: 'var(--sf-paper-4)' }}>
                <Image src={leadImage} alt={vehicleTitle(lead)} fill priority unoptimized sizes="50vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.02]" />
              </div>
              <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4 rounded-[var(--sf-radius-md)] p-4" style={{ background: 'oklch(0.18 0.012 262 / 0.78)', backdropFilter: 'blur(10px)' }}>
                <div className="min-w-0">
                  <p className="sf-eyebrow">{vehicleConditionLabel(lead.condition)}</p>
                  <p className="sf-heading mt-1 truncate text-[var(--sf-text-lg)]">{vehicleTitle(lead)}</p>
                </div>
                <p className="sf-price shrink-0 text-[var(--sf-text-xl)]">{formatPrice(lead.price, business.currencyCode)}</p>
              </div>
            </Link>
          )}
        </Container>
      </section>

      <Container className="relative z-10 -mt-20 md:-mt-24">
        <HeroSearch makes={makes} years={years} />
      </Container>

      <section className="sf-section pt-[var(--sf-space-xl)] md:pt-[var(--sf-space-2xl)]">
        <Container>
          <div className="mb-8 flex items-end justify-between gap-4">
            <h2 className="sf-display text-[length:var(--sf-text-2xl)]">Latest arrivals</h2>
            <Link href="/inventory" className="sf-link inline-flex shrink-0 items-center gap-1 text-[var(--sf-text-sm)]">
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
              <div className="sf-track">
                <Link href="/" prefetch={false} className="sf-pill sf-pill-raised">Retry</Link>
              </div>
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
              <div className="sf-track">
                <Link href="/contact" className="sf-pill sf-pill-raised">Contact sales</Link>
              </div>
            </div>
          )}
        </Container>
      </section>

      <section className="border-t" style={{ borderColor: 'var(--sf-rule)' }}>
        <Container>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {LANES.map((lane, index) => {
              const Icon = lane.icon
              return (
                <li
                  key={lane.href}
                  className={`border-b sm:border-b-0 ${index > 0 ? 'lg:border-l' : ''} ${index % 2 === 1 ? 'sm:border-l' : ''} ${index < 2 ? 'sm:border-b lg:border-b-0' : ''}`}
                  style={{ borderColor: 'var(--sf-rule)' }}
                >
                  <Link href={lane.href} className="group flex h-full items-center gap-4 py-6 sm:flex-col sm:items-start sm:px-6 sm:py-10 lg:first:pl-0">
                    <span className="grid size-11 shrink-0 place-items-center rounded-full" style={{ background: 'var(--sf-paper-2)' }}>
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="sf-eyebrow block">{lane.label}</span>
                      <span className="sf-heading mt-1 block text-[var(--sf-text-lg)] transition-colors group-hover:text-[var(--sf-accent)]">{lane.action}</span>
                    </span>
                    <ArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-1 sm:hidden" aria-hidden="true" />
                  </Link>
                </li>
              )
            })}
          </ul>
        </Container>
      </section>

      <HomeContactPanel />
    </>
  )
}
