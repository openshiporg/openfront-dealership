'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Notice, Pill, Track } from '@/features/platform/components/desk'
import { BUDGET_RANGES, LEAD_SOURCES, STAFF_LEAD_SOURCES, TIMEFRAMES } from '../lib/leadOptions'
import { FormField, NONE } from './FormField'
import type { CrmPerson, CrmRooftop, CrmVehicleOption, LeadFormInput } from '../actions'

export type LeadFormValues = LeadFormInput & { rooftopId: string; assignedToId: string }

export const EMPTY_LEAD_FORM: LeadFormValues = {
  firstName: '', lastName: '', email: '', phone: '', source: 'walk-in', budgetRange: '', timeframe: '',
  tradeInVehicle: '', notes: '', interestedVehicleId: '', rooftopId: '', assignedToId: '',
}

type FieldErrors = Partial<Record<keyof LeadFormValues, string>>

export function validateLeadForm(values: LeadFormValues, requireRooftop: boolean): FieldErrors {
  const errors: FieldErrors = {}
  if (!values.firstName.trim()) errors.firstName = 'Required'
  if (!values.lastName.trim()) errors.lastName = 'Required'
  const email = values.email.trim()
  const phoneDigits = values.phone.replace(/\D/g, '')
  if (!email && !values.phone.trim()) errors.phone = 'Email or phone required'
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Invalid email'
  if (values.phone.trim() && (phoneDigits.length < 7 || phoneDigits.length > 15)) errors.phone = 'Invalid phone'
  if (!values.source) errors.source = 'Required'
  if (requireRooftop && !values.rooftopId) errors.rooftopId = 'Required'
  if (values.notes.length > 4000) errors.notes = 'At most 4000 characters'
  if (values.tradeInVehicle.length > 300) errors.tradeInVehicle = 'At most 300 characters'
  return errors
}

function vehicleLabel(vehicle: CrmVehicleOption) {
  return [vehicle.stockNumber ? `#${vehicle.stockNumber}` : null, vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')
}

export function LeadFormDialog({
  mode,
  open,
  onOpenChange,
  initialValues,
  rooftops,
  vehicles,
  loadStaff,
  onSubmit,
}: {
  mode: 'create' | 'edit'
  open: boolean
  onOpenChange: (open: boolean) => void
  initialValues: LeadFormValues
  rooftops: CrmRooftop[]
  vehicles: CrmVehicleOption[]
  /** Staff eligible for the chosen rooftop; create mode only. */
  loadStaff?: (rooftopId: string) => Promise<CrmPerson[]>
  onSubmit: (values: LeadFormValues) => Promise<string | null>
}) {
  const [values, setValues] = useState<LeadFormValues>(initialValues)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [staff, setStaff] = useState<CrmPerson[]>([])
  const wasOpen = useRef(false)

  useEffect(() => {
    if (open && !wasOpen.current) {
      setValues(initialValues)
      setErrors({})
      setFormError(null)
    }
    wasOpen.current = open
  }, [open, initialValues])

  useEffect(() => {
    if (mode !== 'create' || !loadStaff || !values.rooftopId) { setStaff([]); return }
    let cancelled = false
    loadStaff(values.rooftopId).then(list => { if (!cancelled) setStaff(list) })
    return () => { cancelled = true }
  }, [mode, loadStaff, values.rooftopId])

  const set = <K extends keyof LeadFormValues>(key: K, value: LeadFormValues[K]) => {
    setValues(prev => ({ ...prev, [key]: value, ...(key === 'rooftopId' ? { assignedToId: '', interestedVehicleId: '' } : {}) }))
    setErrors(prev => ({ ...prev, [key]: undefined, ...(key === 'email' || key === 'phone' ? { email: undefined, phone: undefined } : {}) }))
  }

  const requireRooftop = mode === 'create'
  const rooftopVehicles = values.rooftopId ? vehicles.filter(vehicle => !vehicle.rooftop || vehicle.rooftop.id === values.rooftopId) : vehicles
  const sources = mode === 'create' ? STAFF_LEAD_SOURCES : LEAD_SOURCES

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const found = validateLeadForm(values, requireRooftop)
    setErrors(found)
    if (Object.values(found).some(Boolean)) return
    setBusy(true)
    setFormError(null)
    const error = await onSubmit(values)
    setBusy(false)
    if (error) setFormError(error)
  }

  const fieldClass = 'h-11 sm:h-9'

  return (
    <Dialog open={open} onOpenChange={next => { if (!busy) onOpenChange(next) }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New lead' : 'Edit lead details'}</DialogTitle>
          {mode === 'edit' && <DialogDescription>Lead contact and qualification</DialogDescription>}
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            {mode === 'create' && rooftops.length > 1 && (
              <FormField id="lead-rooftop" label="Rooftop" error={errors.rooftopId} className="sm:col-span-2">
                <Select value={values.rooftopId || undefined} onValueChange={value => set('rooftopId', value)}>
                  <SelectTrigger id="lead-rooftop" className={fieldClass} aria-invalid={Boolean(errors.rooftopId)}><SelectValue placeholder="Select rooftop" /></SelectTrigger>
                  <SelectContent>{rooftops.map(rooftop => <SelectItem key={rooftop.id} value={rooftop.id}>{rooftop.name}</SelectItem>)}</SelectContent>
                </Select>
              </FormField>
            )}
            <FormField id="lead-first-name" label="First name" error={errors.firstName}>
              <Input id="lead-first-name" className={fieldClass} value={values.firstName} maxLength={100} autoComplete="off" aria-invalid={Boolean(errors.firstName)} onChange={event => set('firstName', event.target.value)} />
            </FormField>
            <FormField id="lead-last-name" label="Last name" error={errors.lastName}>
              <Input id="lead-last-name" className={fieldClass} value={values.lastName} maxLength={100} autoComplete="off" aria-invalid={Boolean(errors.lastName)} onChange={event => set('lastName', event.target.value)} />
            </FormField>
            <FormField id="lead-phone" label="Phone" error={errors.phone}>
              <Input id="lead-phone" type="tel" inputMode="tel" className={fieldClass} value={values.phone} maxLength={50} aria-invalid={Boolean(errors.phone)} onChange={event => set('phone', event.target.value)} />
            </FormField>
            <FormField id="lead-email" label="Email" error={errors.email}>
              <Input id="lead-email" type="email" inputMode="email" className={fieldClass} value={values.email} maxLength={320} aria-invalid={Boolean(errors.email)} onChange={event => set('email', event.target.value)} />
            </FormField>
            <FormField id="lead-source" label="Source" error={errors.source}>
              <Select value={values.source || undefined} onValueChange={value => set('source', value)}>
                <SelectTrigger id="lead-source" className={fieldClass}><SelectValue placeholder="Select source" /></SelectTrigger>
                <SelectContent>{sources.map(source => <SelectItem key={source.value} value={source.value}>{source.label}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
            {mode === 'create' && (
              <FormField id="lead-owner" label="Salesperson">
                <Select value={values.assignedToId || NONE} onValueChange={value => set('assignedToId', value === NONE ? '' : value)} disabled={requireRooftop && !values.rooftopId}>
                  <SelectTrigger id="lead-owner" className={fieldClass}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Routing rule</SelectItem>
                    {staff.map(person => <SelectItem key={person.id} value={person.id}>{person.name || 'Unnamed'}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
            )}
            <FormField id="lead-vehicle" label="Vehicle of interest" className={mode === 'create' ? 'sm:col-span-2' : undefined}>
              <Select value={values.interestedVehicleId || NONE} onValueChange={value => set('interestedVehicleId', value === NONE ? '' : value)}>
                <SelectTrigger id="lead-vehicle" className={fieldClass}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No vehicle</SelectItem>
                  {rooftopVehicles.map(vehicle => <SelectItem key={vehicle.id} value={vehicle.id}>{vehicleLabel(vehicle)}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <FormField id="lead-timeframe" label="Timeframe">
              <Select value={values.timeframe || NONE} onValueChange={value => set('timeframe', value === NONE ? '' : value)}>
                <SelectTrigger id="lead-timeframe" className={fieldClass}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not set</SelectItem>
                  {TIMEFRAMES.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <FormField id="lead-budget" label="Budget">
              <Select value={values.budgetRange || NONE} onValueChange={value => set('budgetRange', value === NONE ? '' : value)}>
                <SelectTrigger id="lead-budget" className={fieldClass}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not set</SelectItem>
                  {BUDGET_RANGES.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <FormField id="lead-trade" label="Trade-in vehicle" error={errors.tradeInVehicle} className="sm:col-span-2">
              <Input id="lead-trade" className={fieldClass} value={values.tradeInVehicle} maxLength={300} placeholder="Year, make, model, miles" onChange={event => set('tradeInVehicle', event.target.value)} />
            </FormField>
            <FormField id="lead-notes" label="Notes" error={errors.notes} className="sm:col-span-2">
              <Textarea id="lead-notes" rows={3} value={values.notes} maxLength={4000} onChange={event => set('notes', event.target.value)} />
            </FormField>
          </div>
          {formError && <Notice tone="bad">{formError}</Notice>}
          <DialogFooter className="sm:justify-end">
            <Track>
              <Pill variant="plain" className="h-11 sm:h-8" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Pill>
              <Pill type="submit" variant="primary" className="h-11 sm:h-8" disabled={busy}>{busy ? 'Saving…' : mode === 'create' ? 'Create lead' : 'Save'}</Pill>
            </Track>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
