import Link from 'next/link'
import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'

import type { Tone } from '../../lib/accountRecords'

export function AccountBack({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="sf-link -ml-1 inline-flex min-h-11 items-center gap-1 text-[length:var(--sf-text-sm)]">
      <ChevronLeft className="size-4" aria-hidden="true" />
      {label}
    </Link>
  )
}

export function AccountHeader({ eyebrow, title, tone, status, meta }: { eyebrow: string; title: string; tone?: Tone; status?: string; meta?: ReactNode }) {
  return (
    <header className="border-b pb-[var(--sf-space-md)]" style={{ borderColor: 'var(--sf-rule)' }}>
      <p className="sf-eyebrow">{eyebrow}</p>
      <h1 className="sf-title-line mt-3 flex-wrap">
        {tone && <span className="sf-dot" data-tone={tone} aria-hidden="true" />}
        <span className="sf-display text-[length:var(--sf-text-2xl)] sm:text-[length:var(--sf-text-display)]">{title}</span>
        {status && <span className="sf-muted text-[length:var(--sf-text-sm)]">{status}</span>}
      </h1>
      {meta && <div className="sf-muted mt-2 text-[length:var(--sf-text-sm)]">{meta}</div>}
    </header>
  )
}

export function AccountError({ title, retryHref }: { title: string; retryHref: string }) {
  return (
    <div role="alert" className="sf-well space-y-4 p-5">
      <p className="sf-title-line">
        <span className="sf-dot" data-tone="bad" aria-hidden="true" />
        <span className="sf-heading text-[length:var(--sf-text-md)]">{title}</span>
      </p>
      <div className="sf-track">
        <Link href={retryHref} prefetch={false} className="sf-pill sf-pill-raised min-h-11 px-5">Retry</Link>
      </div>
    </div>
  )
}

export function AccountEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="sf-well p-6">
      <p className="sf-muted text-[length:var(--sf-text-sm)]">{children}</p>
    </div>
  )
}

export function AccountSection({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="mt-[var(--sf-space-xl)]">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="sf-heading text-[length:var(--sf-text-xl)]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}
