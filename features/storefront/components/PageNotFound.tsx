import Link from 'next/link'
import { Container } from './Container'

export function PageNotFound() {
  return (
    <Container className="py-[var(--sf-space-2xl)]">
      <div className="sf-well flex flex-col items-start gap-5 p-6 md:p-8">
        <div>
          <p className="sf-eyebrow">404</p>
          <h1 className="sf-title-line sf-heading mt-2 text-[length:var(--sf-text-xl)]">
            <span className="sf-dot" aria-hidden="true" />
            Page not found
          </h1>
        </div>
        <div className="sf-track">
          <Link href="/" className="sf-pill sf-pill-primary min-h-11 sm:min-h-9">Home</Link>
          <Link href="/inventory" className="sf-pill min-h-11 sm:min-h-9">Inventory</Link>
        </div>
      </div>
    </Container>
  )
}
