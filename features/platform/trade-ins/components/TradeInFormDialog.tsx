'use client'

import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Notice, Pill, Track } from '@/features/platform/components/desk'
import type { TradeInLeadOption, TradeInRooftop } from '../actions'
import { CONDITION_OPTIONS, VIN_PATTERN } from '../lib/tradeInState'

export type TradeInFormValues = {
  rooftopId: string
  leadId: string
  vin: string
  year: string
  make: string
  model: string
  trim: string
  mileage: string
  condition: string
  exteriorCondition: string
  interiorCondition: string
  mechanicalIssues: string
}

export const EMPTY_TRADE_IN_FORM: TradeInFormValues = {
  rooftopId: '', leadId: '', vin: '', year: '', make: '', model: '', trim: '', mileage: '', condition: '',
  exteriorCondition: '', interiorCondition: '', mechanicalIssues: '',
}

const NO_LEAD = 'none'
const fieldLabel = 'font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground'

export function validateTradeInForm(values: TradeInFormValues, mode: 'create' | 'edit', leadRequired: boolean) {
  const errors: Partial<Record<keyof TradeInFormValues, string>> = {}
  if (mode === 'create' && !values.rooftopId) errors.rooftopId = 'Select a rooftop'
  if (mode === 'create' && leadRequired && !values.leadId) errors.leadId = 'Select the customer lead'
  const vin = values.vin.trim().toUpperCase()
  if (vin && !VIN_PATTERN.test(vin)) errors.vin = '17 letters and numbers, no I, O or Q'
  const year = Number(values.year)
  if (!/^\d{4}$/.test(values.year.trim()) || year < 1900 || year > new Date().getFullYear() + 2) errors.year = 'Enter a 4-digit year'
  if (!values.make.trim()) errors.make = 'Make is required'
  if (!values.model.trim()) errors.model = 'Model is required'
  const mileage = values.mileage.trim().replace(/,/g, '')
  if (mileage && (!/^\d+$/.test(mileage) || Number(mileage) > 2_000_000)) errors.mileage = 'Enter whole miles'
  return errors
}

/** Form values as the TradeIn vehicle and condition fields. */
export function tradeInDetailsPayload(values: TradeInFormValues) {
  const mileage = values.mileage.trim().replace(/,/g, '')
  return {
    vin: values.vin.trim().toUpperCase(),
    year: values.year.trim(),
    make: values.make.trim(),
    model: values.model.trim(),
    trim: values.trim.trim(),
    mileage: mileage ? Number(mileage) : null,
    condition: values.condition || null,
    exteriorCondition: values.exteriorCondition.trim(),
    interiorCondition: values.interiorCondition.trim(),
    mechanicalIssues: values.mechanicalIssues.trim(),
  }
}

function Field({ label, error, htmlFor, children, wide }: { label: string; error?: string; htmlFor: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`grid min-w-0 gap-1.5 text-sm ${wide ? 'sm:col-span-2' : ''}`}>
      <label htmlFor={htmlFor} className={fieldLabel}>{label}</label>
      {children}
      {error && <p id={`${htmlFor}-error`} className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}

export function TradeInFormDialog({
  open,
  mode,
  initialValues,
  rooftops = [],
  leads = [],
  leadRequired = false,
  busy,
  error,
  onSubmit,
  onOpenChange,
}: {
  open: boolean
  mode: 'create' | 'edit'
  initialValues: TradeInFormValues
  rooftops?: TradeInRooftop[]
  leads?: TradeInLeadOption[]
  leadRequired?: boolean
  busy: boolean
  error: string | null
  onSubmit: (values: TradeInFormValues) => void
  onOpenChange: (open: boolean) => void
}) {
  const [values, setValues] = useState<TradeInFormValues>(initialValues)
  const [showErrors, setShowErrors] = useState(false)

  useEffect(() => {
    if (open) {
      setValues(initialValues)
      setShowErrors(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const errors = validateTradeInForm(values, mode, leadRequired)
  const shown = showErrors ? errors : {}
  const set = (name: keyof TradeInFormValues, value: string) => setValues(current => ({ ...current, [name]: value }))
  const rooftopLeads = leads.filter(lead => !values.rooftopId || lead.rooftop?.id === values.rooftopId)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setShowErrors(true)
    if (Object.keys(errors).length) return
    onSubmit(values)
  }

  const input = (name: keyof TradeInFormValues, props: Record<string, unknown> = {}) => (
    <Input
      id={`trade-in-${name}`}
      value={values[name]}
      onChange={event => set(name, event.target.value)}
      aria-invalid={shown[name] ? true : undefined}
      aria-describedby={shown[name] ? `trade-in-${name}-error` : undefined}
      {...props}
    />
  )

  return (
    <Dialog open={open} onOpenChange={value => { if (!busy) onOpenChange(value) }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New trade-in' : 'Edit trade-in'}</DialogTitle>
          <DialogDescription>{mode === 'create' ? 'Walk-in or phone appraisal' : 'Vehicle and condition'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {mode === 'create' && (
              <>
                <Field label="Rooftop" htmlFor="trade-in-rooftopId" error={shown.rooftopId}>
                  <Select value={values.rooftopId} onValueChange={value => setValues(current => ({ ...current, rooftopId: value, leadId: '' }))}>
                    <SelectTrigger id="trade-in-rooftopId" aria-invalid={shown.rooftopId ? true : undefined}><SelectValue placeholder="Select rooftop" /></SelectTrigger>
                    <SelectContent>{rooftops.map(rooftop => <SelectItem key={rooftop.id} value={rooftop.id}>{rooftop.name}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label={leadRequired ? 'Customer lead' : 'Customer lead (optional)'} htmlFor="trade-in-leadId" error={shown.leadId}>
                  <Select value={values.leadId || (leadRequired ? '' : NO_LEAD)} onValueChange={value => set('leadId', value === NO_LEAD ? '' : value)} disabled={!values.rooftopId}>
                    <SelectTrigger id="trade-in-leadId" aria-invalid={shown.leadId ? true : undefined}><SelectValue placeholder={values.rooftopId ? 'Select lead' : 'Choose a rooftop first'} /></SelectTrigger>
                    <SelectContent>
                      {!leadRequired && <SelectItem value={NO_LEAD}>No lead</SelectItem>}
                      {rooftopLeads.map(lead => (
                        <SelectItem key={lead.id} value={lead.id}>{[lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.email || 'Customer'}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </>
            )}
            <Field label="VIN" htmlFor="trade-in-vin" error={shown.vin} wide>
              {input('vin', { maxLength: 17, autoComplete: 'off', className: 'font-mono uppercase', placeholder: 'Optional until acquisition' })}
            </Field>
            <Field label="Year" htmlFor="trade-in-year" error={shown.year}>{input('year', { inputMode: 'numeric', maxLength: 4 })}</Field>
            <Field label="Make" htmlFor="trade-in-make" error={shown.make}>{input('make', { maxLength: 100 })}</Field>
            <Field label="Model" htmlFor="trade-in-model" error={shown.model}>{input('model', { maxLength: 100 })}</Field>
            <Field label="Trim" htmlFor="trade-in-trim">{input('trim', { maxLength: 100 })}</Field>
            <Field label="Mileage" htmlFor="trade-in-mileage" error={shown.mileage}>{input('mileage', { inputMode: 'numeric' })}</Field>
            <Field label="Condition" htmlFor="trade-in-condition">
              <Select value={values.condition} onValueChange={value => set('condition', value)}>
                <SelectTrigger id="trade-in-condition"><SelectValue placeholder="Select condition" /></SelectTrigger>
                <SelectContent>{CONDITION_OPTIONS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            {(['exteriorCondition', 'interiorCondition', 'mechanicalIssues'] as const).map(name => (
              <Field key={name} wide htmlFor={`trade-in-${name}`} label={name === 'exteriorCondition' ? 'Exterior notes' : name === 'interiorCondition' ? 'Interior notes' : 'Mechanical issues'}>
                <Textarea id={`trade-in-${name}`} rows={2} maxLength={2000} value={values[name]} onChange={event => set(name, event.target.value)} />
              </Field>
            ))}
          </div>
          {error && <Notice tone="bad">{error}</Notice>}
          <DialogFooter className="sm:justify-end">
            <Track>
              <Pill variant="plain" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Pill>
              <Pill type="submit" variant="primary" disabled={busy}>{busy ? 'Saving…' : mode === 'create' ? 'Create trade-in' : 'Save'}</Pill>
            </Track>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
