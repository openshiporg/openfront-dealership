import Link from 'next/link'
import { fetchGraphQL } from '@/features/storefront/lib/data/graphql-client'
import { GET_MAKES, GET_VEHICLES, GET_VEHICLES_COUNT } from '@/features/storefront/lib/data/queries'
import { Make, Vehicle } from '@/features/storefront/lib/types'
import { Button } from '../components/Button'
import { Container } from '../components/Container'
import { HeroSearch } from '../components/HeroSearch'
import { HomeContactPanel } from '../components/HomeContactPanel'
import { VehicleCard } from '../components/VehicleCard'
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

export async function HomePage() {
  const [featured, inventoryCount, makes, settings] = await Promise.all([
    getFeaturedVehicles(),
    getInventoryCount(),
    getMakes(),
    loadStorefrontBusiness(),
  ])
  const business = settings.status === 'ready' ? settings.business : createStorefrontBusiness()
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 30 }, (_, i) => currentYear - i)
  const lead = featured.status === 'ready' ? featured.value[0] : undefined

  return (
    <>
      <section className="border-b" style={{ borderColor: 'var(--sf-rule)' }}>
        <Container className="py-[var(--sf-space-2xl)] md:py-[var(--sf-space-3xl)]">
          <div className="grid lg:grid-cols-[1fr_0.9fr] gap-[var(--sf-space-xl)] items-end">
            <div className="min-w-0">
              <p className="sf-eyebrow mb-[var(--sf-space-sm)]">On the lot now</p>
              <h1 className="sf-display text-[length:var(--sf-text-display)] max-w-[14ch]">
                {business.homepageTitle || (inventoryCount.status === 'ready' && inventoryCount.value > 0
                  ? `${inventoryCount.value} vehicles`
                  : business.fullName)}
              </h1>
              {business.homepageDescription && (
                <p className="mt-[var(--sf-space-md)] max-w-md text-[var(--sf-text-md)] leading-relaxed" style={{ color: 'var(--sf-ink-2)' }}>
                  {business.homepageDescription}
                </p>
              )}
              <div className="mt-[var(--sf-space-lg)] flex flex-wrap gap-3">
                <Button href="/inventory">Browse inventory</Button>
                <Button href="/test-drive" variant="secondary">
                  Schedule test drive
                </Button>
              </div>
            </div>

            {lead && (
              <div className="hidden lg:block min-w-0">
                <p className="sf-eyebrow mb-3">Featured</p>
                <VehicleCard vehicle={lead} layout="feature" priority />
              </div>
            )}
          </div>

          <div className="mt-[var(--sf-space-xl)]">
            <HeroSearch makes={makes} years={years} />
          </div>
        </Container>
      </section>

      <section>
        <Container className="py-[var(--sf-space-2xl)]">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-[var(--sf-space-lg)]">
            <div>
              <h2 className="sf-display text-[length:var(--sf-text-2xl)]">Latest arrivals</h2>
            </div>
            <Link href="/inventory" className="text-[var(--sf-text-sm)] font-semibold hover:text-[var(--sf-accent)] transition-colors">
              View all →
            </Link>
          </div>

          {featured.status === 'unavailable' ? (
            <div className="sf-card p-[var(--sf-space-xl)] text-center" role="alert">
              <p className="text-[var(--sf-text-md)]" style={{ color: 'var(--sf-ink-2)' }}>
                Inventory couldn&apos;t be loaded.
              </p>
              <div className="mt-4">
                <Link href="/" prefetch={false} className="sf-btn sf-btn-secondary">Retry</Link>
              </div>
            </div>
          ) : featured.value.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[var(--sf-space-md)] min-w-0">
              {featured.value.map((vehicle) => (
                <VehicleCard key={vehicle.id} vehicle={vehicle} priority />
              ))}
            </div>
          ) : (
            <div className="sf-card p-[var(--sf-space-xl)] text-center">
              <p className="text-[var(--sf-text-md)]" style={{ color: 'var(--sf-ink-2)' }}>
                No vehicles are listed right now.
              </p>
              <div className="mt-4">
                <Button href="/contact" variant="secondary">
                  Contact sales
                </Button>
              </div>
            </div>
          )}
        </Container>
      </section>

      <section style={{ background: 'var(--sf-paper-2)' }}>
        <Container className="py-[var(--sf-space-2xl)]">
          <div className="grid md:grid-cols-2 gap-[var(--sf-space-xl)]">
            <div>
              <h2 className="sf-display text-[length:var(--sf-text-xl)]">Shop with us</h2>
              <ul className="mt-[var(--sf-space-md)] space-y-4">
                {[
                  { href: '/financing', title: 'Get financing' },
                  { href: '/trade-in', title: 'Value your trade' },
                  { href: '/service', title: 'Book service' },
                ].map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="group block">
                      <p className="font-semibold group-hover:text-[var(--sf-accent)] transition-colors">{item.title}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <HomeContactPanel />
          </div>
        </Container>
      </section>
    </>
  )
}
