'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Label, control and inline error for CRM and customer dialogs. */
export function FormField({
  id,
  label,
  error,
  className,
  children,
}: {
  id: string
  label: string
  error?: string | null
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('grid min-w-0 gap-1.5 text-sm', className)}>
      <label htmlFor={id} className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </label>
      {children}
      {error && <p id={`${id}-error`} className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}

/** A Select needs a non-empty value; this sentinel stands for "none chosen". */
export const NONE = '__none__'
