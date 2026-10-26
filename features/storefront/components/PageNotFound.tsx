import Link from 'next/link'
import { Container } from './Container'

export function PageNotFound() {
  return (
    <Container className="py-[var(--sf-space-2xl)]">
      <div className="sf-well flex flex-col items-start gap-5 p-6 md:p-8">
        <h1 className="sf-title-line sf-heading text-[length:var(--sf-text-xl)]">
          <span className="sf-dot" aria-hidden="true" />
          Page not found
        </h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/" className="sf-btn sf-btn-primary">Home</Link>
          <Link href="/inventory" className="sf-btn sf-btn-ghost">Inventory</Link>
        </div>
      </div>
    </Container>
  )
}
