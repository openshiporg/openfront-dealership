import type { ReactNode } from 'react'

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  tone = 'light',
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  tone?: 'light' | 'dark'
}) {
  return (
    <section
      className={tone === 'dark' ? 'sf-band' : 'border-b'}
      style={tone === 'dark' ? undefined : { borderColor: 'var(--sf-rule)' }}
    >
      <div className="sf-container flex flex-col gap-5 py-[var(--sf-space-lg)] md:flex-row md:items-end md:justify-between md:py-[var(--sf-space-xl)]">
        <div className="min-w-0">
          {eyebrow && <p className="sf-eyebrow mb-3">{eyebrow}</p>}
          <h1 className="sf-display max-w-3xl text-[length:var(--sf-text-display)]">{title}</h1>
          {description && (
            <p className="sf-muted mt-3 max-w-xl text-[length:var(--sf-text-md)]">{description}</p>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </section>
  )
}
