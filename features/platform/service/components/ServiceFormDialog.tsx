'use client'

import type { FormEvent, ReactNode } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Notice, Pill, Track } from '@/features/platform/components/desk'

export type ServiceFormField = {
  name: string
  label: string
  type?: 'text' | 'textarea' | 'select' | 'money' | 'number' | 'datetime-local'
  options?: Array<{ value: string; label: string }>
  placeholder?: string
  hint?: string
  inputMode?: 'decimal' | 'numeric'
  wide?: boolean
}

/** Dialog form whose validation errors sit under each field. */
export function ServiceFormDialog({
  open,
  title,
  fields,
  values,
  errors,
  formError,
  busy,
  submitLabel = 'Save',
  submitVariant = 'primary',
  extra,
  onValuesChange,
  onSubmit,
  onOpenChange,
}: {
  open: boolean
  title: string
  fields: ServiceFormField[]
  values: Record<string, string>
  errors: Record<string, string>
  formError?: string | null
  busy: boolean
  submitLabel?: string
  submitVariant?: 'primary' | 'danger'
  extra?: ReactNode
  onValuesChange: (values: Record<string, string>) => void
  onSubmit: () => void
  onOpenChange: (open: boolean) => void
}) {
  const change = (name: string, value: string) => onValuesChange({ ...values, [name]: value })
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit()
  }
  return (
    <Dialog open={open} onOpenChange={value => { if (!busy) onOpenChange(value) }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          {fields.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map(field => {
                const id = `service-${field.name}`
                const error = errors[field.name]
                const describedBy = error ? `${id}-error` : field.hint ? `${id}-hint` : undefined
                const wide = field.wide || field.type === 'textarea'
                return (
                  <div key={field.name} className={`grid gap-1.5 text-sm ${wide ? 'sm:col-span-2' : ''}`}>
                    <label htmlFor={id} className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{field.label}</label>
                    {field.type === 'textarea' ? (
                      <Textarea id={id} rows={3} value={values[field.name] || ''} placeholder={field.placeholder} aria-invalid={Boolean(error) || undefined} aria-describedby={describedBy} onChange={event => change(field.name, event.target.value)} />
                    ) : field.type === 'select' ? (
                      <Select value={values[field.name] || ''} onValueChange={value => change(field.name, value)}>
                        <SelectTrigger id={id} className="h-11 sm:h-9" aria-label={field.label} aria-invalid={Boolean(error) || undefined} aria-describedby={describedBy}>
                          <SelectValue placeholder={field.placeholder || 'Select'} />
                        </SelectTrigger>
                        <SelectContent>
                          {(field.options || []).map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id={id}
                        className={`h-11 sm:h-9 ${field.type === 'money' || field.type === 'number' ? 'tabular-nums' : ''} ${field.type === 'money' ? 'text-right' : ''}`}
                        type={field.type === 'datetime-local' ? 'datetime-local' : 'text'}
                        inputMode={field.type === 'money' ? 'decimal' : field.inputMode}
                        autoComplete="off"
                        value={values[field.name] || ''}
                        placeholder={field.placeholder}
                        aria-invalid={Boolean(error) || undefined}
                        aria-describedby={describedBy}
                        onChange={event => change(field.name, event.target.value)}
                      />
                    )}
                    {error ? (
                      <span id={`${id}-error`} className="text-xs text-red-600 dark:text-red-400">{error}</span>
                    ) : field.hint ? (
                      <span id={`${id}-hint`} className="text-xs text-muted-foreground">{field.hint}</span>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
          {extra}
          {formError && <Notice tone="bad">{formError}</Notice>}
          <DialogFooter className="sm:justify-end">
            <Track>
              <Pill variant="plain" className="max-sm:h-11" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Pill>
              <Pill type="submit" variant={submitVariant} className="max-sm:h-11" disabled={busy}>{busy ? 'Saving…' : submitLabel}</Pill>
            </Track>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
