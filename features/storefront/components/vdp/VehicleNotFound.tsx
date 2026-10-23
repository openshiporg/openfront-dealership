import Link from 'next/link'
import { Container } from '../Container'

export function VehicleNotFound() {
  return (
    <Container className="py-[var(--sf-space-2xl)]">
      <div className="sf-well flex flex-col items-start gap-5 p-6 md:p-8">
        <div>
          <h1 className="sf-title-line sf-heading text-[var(--sf-text-xl)]">
            <span className="sf-dot" aria-hidden="true" />
            Vehicle not found
          </h1>
          <p className="sf-muted mt-2 pl-4">This vehicle is no longer available.</p>
        </div>
        <div className="sf-track">
          <Link href="/inventory" className="sf-pill sf-pill-primary min-h-11 sm:min-h-9">Back to inventory</Link>
        </div>
      </div>
    </Container>
  )
}
