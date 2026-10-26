import type { ReactNode } from 'react'
import { Figure } from '@/features/platform/components/desk'

/**
 * The numbers a lot writes on the glass: price, stock number, days. Built from the kit's Figure;
 * `attention` marks a figure in lot yellow (aged, overdue), using thresholds the page already applies.
 */
export function Windshield({ children, label }: { children: ReactNode; label: string }) {
  return (
    <dl aria-label={label} className="flex min-w-0 flex-wrap items-end gap-x-8 gap-y-3 border-b border-foreground/15 pb-4">
      {children}
    </dl>
  )
}

export function WindshieldFigure({ label, value, sub, attention }: { label: ReactNode; value: ReactNode; sub?: ReactNode; attention?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-foreground">
        <Figure size="lg" attention={attention} className="text-[32px] sm:text-[40px]">{value}</Figure>
        {sub && <p className="mt-1 truncate text-xs text-muted-foreground">{sub}</p>}
      </dd>
    </div>
  )
}
