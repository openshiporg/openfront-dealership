'use client'

import type { FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export type OperatorActionField = {
  name: string
  label: string
  type?: 'text' | 'number' | 'email' | 'datetime-local' | 'date' | 'textarea' | 'select' | 'checkbox'
  required?: boolean
  min?: number | string
  max?: number | string
  step?: number
  maxLength?: number
  placeholder?: string
  description?: string
  options?: Array<{ value: string; label: string }>
}

export function OperatorActionDialog({
  open,
  title,
  description,
  fields,
  values,
  error,
  busy = false,
  submitLabel = 'Save',
  onValuesChange,
  onSubmit,
  onOpenChange,
}: {
  open: boolean
  title: string
  description?: string
  fields: OperatorActionField[]
  values: Record<string, string>
  error?: string | null
  busy?: boolean
  submitLabel?: string
  onValuesChange: (values: Record<string, string>) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onOpenChange: (open: boolean) => void
}) {
  const change = (name: string, value: string) => onValuesChange({ ...values, [name]: value })
  return <Dialog open={open} onOpenChange={value => { if (!busy) onOpenChange(value) }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map(field => <label key={field.name} htmlFor={`operator-${field.name}`} className={`grid gap-1.5 text-sm ${field.type === 'textarea' ? 'sm:col-span-2' : ''}`}>
            <span className="font-medium">{field.label}</span>
            {field.type === 'textarea' ? <Textarea id={`operator-${field.name}`} required={field.required ?? true} maxLength={field.maxLength} placeholder={field.placeholder} value={values[field.name] || ''} onChange={event => change(field.name, event.target.value)} rows={3} /> :
              field.type === 'select' ? <Select required={field.required ?? true} value={values[field.name] || ''} onValueChange={value => change(field.name, value)}>
                <SelectTrigger id={`operator-${field.name}`} aria-label={field.label}><SelectValue placeholder={field.placeholder || `Select ${field.label.toLowerCase()}`} /></SelectTrigger>
                <SelectContent>{(field.options || []).map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
              </Select> :
                field.type === 'checkbox' ? <span className="flex items-start gap-2 rounded-md border p-3"><input id={`operator-${field.name}`} type="checkbox" required={field.required ?? true} checked={values[field.name] === 'yes'} onChange={event => change(field.name, event.target.checked ? 'yes' : '')} /><span>{field.description || field.label}</span></span> :
                  <Input id={`operator-${field.name}`} type={field.type || 'text'} required={field.required ?? true} min={field.min} max={field.max} step={field.step} maxLength={field.maxLength} placeholder={field.placeholder} value={values[field.name] || ''} onChange={event => change(field.name, event.target.value)} />}
            {field.description && field.type !== 'checkbox' && <span className="text-xs text-muted-foreground">{field.description}</span>}
          </label>)}
        </div>
        {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : submitLabel}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
