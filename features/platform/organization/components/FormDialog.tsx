'use client'

import type { FormEvent, ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Notice, Pill, Track } from '@/features/platform/components/desk'

export type FieldErrors = Record<string, string>

/** Dialog form shell: inline field errors live in each <Field>, a form-level error above the footer. */
export function FormDialog({
  open,
  title,
  description,
  error,
  busy = false,
  submitLabel = 'Save',
  submitVariant = 'primary',
  submitDisabled,
  onSubmit,
  onOpenChange,
  children,
  wide,
}: {
  open: boolean
  title: string
  description?: string
  error?: string | null
  busy?: boolean
  submitLabel?: string
  submitVariant?: 'primary' | 'danger'
  submitDisabled?: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onOpenChange: (open: boolean) => void
  children: ReactNode
  wide?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={value => { if (!busy) onOpenChange(value) }}>
      <DialogContent className={cn('max-h-[90dvh] overflow-y-auto', wide ? 'sm:max-w-2xl' : 'sm:max-w-lg')}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form noValidate onSubmit={onSubmit} className="space-y-4">
          {children}
          {error && <Notice tone="bad">{error}</Notice>}
          <DialogFooter className="sm:justify-end">
            <Track>
              <Pill variant="plain" className="h-11 sm:h-8" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Pill>
              <Pill type="submit" variant={submitVariant} className="h-11 sm:h-8" disabled={busy || submitDisabled}>
                {busy ? 'Saving…' : submitLabel}
              </Pill>
            </Track>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function Field({
  id,
  label,
  error,
  hint,
  children,
  className,
}: {
  id: string
  label: string
  error?: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('grid min-w-0 gap-1.5 text-sm', className)}>
      <label htmlFor={id} className="text-[12px] font-medium text-muted-foreground">{label}</label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-red-700 dark:text-red-300">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

/** Props for an input inside <Field> so the error is announced. */
export function fieldA11y(id: string, error?: string) {
  return { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': error ? `${id}-error` : undefined }
}

export function newIdempotencyKey(prefix: string) {
  return `${prefix}:${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
}

export function formatWhen(value: string | null | undefined, timeZone: string) {
  if (!value) return ''
  return new Date(value).toLocaleString('en-US', { timeZone, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function formatDate(value: string | null | undefined, timeZone: string) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('en-US', { timeZone, month: 'short', day: 'numeric', year: 'numeric' })
}
