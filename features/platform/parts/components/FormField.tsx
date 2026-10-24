'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Labelled form control with its error shown inline under it. */
export function FormField({
  id,
  label,
  error,
  hint,
  className,
  children,
}: {
  id: string
  label: string
  error?: string | null
  hint?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('grid min-w-0 gap-1.5 text-sm', className)}>
      <label htmlFor={id} className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

export type FieldErrors = Record<string, string | undefined>

export function hasErrors(errors: FieldErrors) {
  return Object.values(errors).some(Boolean)
}

/** Whole number from a text input; null when it is not one or is below `min`. */
export function parseWhole(text: string, min = 0): number | null {
  const cleaned = text.trim().replace(/,/g, '')
  if (!/^-?\d+$/.test(cleaned)) return null
  const value = Number(cleaned)
  return Number.isSafeInteger(value) && value >= min ? value : null
}
