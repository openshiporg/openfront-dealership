'use client'

import { useEffect, useState, type ComponentProps } from 'react'
import { Input } from '@/components/ui/input'
import { formatCentsForInput, parseDollarsToCents } from '../lib/moneyInput'

/** Dollar input that accepts "$33,450.50" and reports integer cents. */
export function MoneyInput({ cents, onCentsChange, className = '', ...props }: Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> & {
  cents: number
  onCentsChange: (cents: number) => void
}) {
  const [draft, setDraft] = useState(() => formatCentsForInput(cents))
  const parsed = parseDollarsToCents(draft)

  // Follow outside changes (reloads, recomputed lines) without clobbering what is being typed.
  useEffect(() => {
    if (parseDollarsToCents(draft) !== cents) setDraft(formatCentsForInput(cents))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cents])

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className={`rounded-[4px] text-right tabular-nums shadow-none ${className}`}
      value={draft}
      aria-invalid={parsed === null || props['aria-invalid'] || undefined}
      onChange={(event) => {
        setDraft(event.target.value)
        const next = parseDollarsToCents(event.target.value)
        if (next !== null) onCentsChange(next)
      }}
      onBlur={(event) => {
        if (parsed !== null) setDraft(formatCentsForInput(parsed))
        props.onBlur?.(event)
      }}
    />
  )
}
