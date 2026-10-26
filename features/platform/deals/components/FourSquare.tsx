import type { ReactNode } from 'react'
import { Figure } from '@/features/platform/components/desk'

export type FourSquareCell = { label: string; value: ReactNode; sub?: ReactNode; attention?: boolean }

/**
 * The desk's four-square: price, trade, down and payment as windshield figures in a
 * hairline grid, two up on phones. A footer row carries the totals the squares add up to.
 */
export function FourSquare({ cells, footer }: { cells: ReadonlyArray<FourSquareCell>; footer?: ReactNode }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-md border bg-card">
      <dl className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
        {cells.map(cell => (
          <div key={cell.label} className="min-w-0 bg-card px-4 py-3">
            <dt className="text-[12px] font-medium text-muted-foreground">{cell.label}</dt>
            <dd className="mt-1.5 truncate text-foreground">
              <Figure size="lg" attention={cell.attention}>{cell.value}</Figure>
            </dd>
            {cell.sub && <dd className="mt-1 truncate text-xs text-muted-foreground">{cell.sub}</dd>}
          </div>
        ))}
      </dl>
      {footer && <div className="flex min-w-0 flex-wrap items-baseline gap-x-6 gap-y-2 border-t bg-muted/40 px-4 py-2.5 text-[13px]">{footer}</div>}
    </div>
  )
}
