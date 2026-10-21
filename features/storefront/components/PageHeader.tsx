export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string
  title: string
  description?: string
}) {
  return (
    <section style={{ background: 'var(--sf-paper-3)', color: 'var(--sf-accent-ink)' }}>
      <div className="sf-container py-[var(--sf-space-xl)]">
        {eyebrow && <p className="sf-eyebrow opacity-70 mb-2">{eyebrow}</p>}
        <h1 className="sf-display text-[length:var(--sf-text-display)] max-w-2xl">{title}</h1>
        {description && (
          <p className="mt-3 text-[var(--sf-text-md)] opacity-80 max-w-xl leading-relaxed">{description}</p>
        )}
      </div>
    </section>
  )
}
