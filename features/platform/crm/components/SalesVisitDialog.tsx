'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Notice, Pill, Track } from '@/features/platform/components/desk'
import { fromZonedInputValue, toZonedInputValue, VISIT_OUTCOMES } from '../lib/leadOptions'
import { FormField, NONE } from './FormField'
import type { CrmPerson, CrmVehicleOption } from '../actions'

export type VisitDialogAction = 'schedule' | 'arrive' | 'manager-turn' | 'complete' | 'cancel' | 'no-show'

export type VisitDialogValues = {
  kind: string
  scheduledAt: string
  vehicleId: string
  managerId: string
  outcome: string
  notes: string
}

const TITLES: Record<VisitDialogAction, string> = {
  schedule: 'Schedule visit',
  arrive: 'Check in',
  'manager-turn': 'Manager turn',
  complete: 'Complete visit',
  cancel: 'Cancel visit',
  'no-show': 'Mark no-show',
}

const SUBMIT: Record<VisitDialogAction, string> = {
  schedule: 'Schedule',
  arrive: 'Check in',
  'manager-turn': 'Hand to manager',
  complete: 'Complete',
  cancel: 'Cancel visit',
  'no-show': 'Mark no-show',
}

function vehicleLabel(vehicle: CrmVehicleOption) {
  return [vehicle.stockNumber ? `#${vehicle.stockNumber}` : null, vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')
}

export function SalesVisitDialog({
  action,
  open,
  onOpenChange,
  timeZone,
  staff,
  vehicles,
  defaultVehicleId,
  viewerId,
  onSubmit,
}: {
  action: VisitDialogAction
  open: boolean
  onOpenChange: (open: boolean) => void
  timeZone: string
  staff: CrmPerson[]
  vehicles: CrmVehicleOption[]
  defaultVehicleId: string | null
  viewerId: string | null
  onSubmit: (values: VisitDialogValues & { scheduledAtIso: string | null }) => Promise<string | null>
}) {
  const [values, setValues] = useState<VisitDialogValues>({ kind: 'appointment', scheduledAt: '', vehicleId: '', managerId: '', outcome: '', notes: '' })
  const [errors, setErrors] = useState<Partial<Record<keyof VisitDialogValues, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const wasOpen = useRef(false)

  useEffect(() => {
    if (open && !wasOpen.current) {
      const nextHour = Math.ceil((Date.now() + 30 * 60_000) / 3_600_000) * 3_600_000
      setValues({
        kind: 'appointment',
        scheduledAt: toZonedInputValue(nextHour, timeZone),
        vehicleId: defaultVehicleId || '',
        managerId: viewerId && staff.some(person => person.id === viewerId) ? viewerId : '',
        outcome: '',
        notes: '',
      })
      setErrors({})
      setFormError(null)
    }
    wasOpen.current = open
  }, [open, timeZone, defaultVehicleId, viewerId, staff])

  const set = <K extends keyof VisitDialogValues>(key: K, value: VisitDialogValues[K]) => {
    setValues(prev => ({ ...prev, [key]: value }))
    setErrors(prev => ({ ...prev, [key]: undefined }))
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const found: Partial<Record<keyof VisitDialogValues, string>> = {}
    let scheduledAtIso: string | null = null
    if (action === 'schedule' && values.kind === 'appointment') {
      scheduledAtIso = values.scheduledAt ? fromZonedInputValue(values.scheduledAt, timeZone) : null
      if (!scheduledAtIso) found.scheduledAt = 'Required'
    }
    if (action === 'manager-turn' && !values.managerId) found.managerId = 'Required'
    if (action === 'complete' && !values.outcome) found.outcome = 'Required'
    if (values.notes.length > 4000) found.notes = 'At most 4000 characters'
    setErrors(found)
    if (Object.values(found).some(Boolean)) return
    setBusy(true)
    setFormError(null)
    const error = await onSubmit({ ...values, scheduledAtIso })
    setBusy(false)
    if (error) setFormError(error)
  }

  const fieldClass = 'h-11 sm:h-9'

  return (
    <Dialog open={open} onOpenChange={next => { if (!busy) onOpenChange(next) }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{TITLES[action]}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          {action === 'schedule' && (
            <>
              <FormField id="visit-kind" label="Type">
                <Select value={values.kind} onValueChange={value => set('kind', value)}>
                  <SelectTrigger id="visit-kind" className={fieldClass}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="appointment">Sales appointment</SelectItem>
                    <SelectItem value="showroom">Showroom up (arrived now)</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              {values.kind === 'appointment' && (
                <FormField id="visit-time" label="Time" error={errors.scheduledAt}>
                  <Input id="visit-time" type="datetime-local" className={fieldClass} value={values.scheduledAt} aria-invalid={Boolean(errors.scheduledAt)} onChange={event => set('scheduledAt', event.target.value)} />
                </FormField>
              )}
              <FormField id="visit-vehicle" label="Vehicle">
                <Select value={values.vehicleId || NONE} onValueChange={value => set('vehicleId', value === NONE ? '' : value)}>
                  <SelectTrigger id="visit-vehicle" className={fieldClass}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>No vehicle</SelectItem>
                    {vehicles.map(vehicle => <SelectItem key={vehicle.id} value={vehicle.id}>{vehicleLabel(vehicle)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
            </>
          )}
          {action === 'manager-turn' && (
            <FormField id="visit-manager" label="Manager" error={errors.managerId}>
              <Select value={values.managerId || undefined} onValueChange={value => set('managerId', value)}>
                <SelectTrigger id="visit-manager" className={fieldClass} aria-invalid={Boolean(errors.managerId)}><SelectValue placeholder="Select manager" /></SelectTrigger>
                <SelectContent>{staff.map(person => <SelectItem key={person.id} value={person.id}>{person.name || 'Unnamed'}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
          )}
          {action === 'complete' && (
            <FormField id="visit-outcome" label="Outcome" error={errors.outcome}>
              <Select value={values.outcome || undefined} onValueChange={value => set('outcome', value)}>
                <SelectTrigger id="visit-outcome" className={fieldClass} aria-invalid={Boolean(errors.outcome)}><SelectValue placeholder="Select outcome" /></SelectTrigger>
                <SelectContent>{VISIT_OUTCOMES.map(outcome => <SelectItem key={outcome.value} value={outcome.value}>{outcome.label}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
          )}
          <FormField id="visit-notes" label="Notes" error={errors.notes}>
            <Textarea id="visit-notes" rows={3} maxLength={4000} value={values.notes} onChange={event => set('notes', event.target.value)} />
          </FormField>
          {formError && <Notice tone="bad">{formError}</Notice>}
          <DialogFooter className="sm:justify-end">
            <Track>
              <Pill variant="plain" className="h-11 sm:h-8" disabled={busy} onClick={() => onOpenChange(false)}>Back</Pill>
              <Pill type="submit" variant={action === 'cancel' || action === 'no-show' ? 'danger' : 'primary'} className="h-11 sm:h-8" disabled={busy}>
                {busy ? 'Saving…' : SUBMIT[action]}
              </Pill>
            </Track>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
