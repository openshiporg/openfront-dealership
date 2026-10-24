'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Notice, Panel, Pill, Segmented, Track } from '@/features/platform/components/desk'
import { formatPhone } from '@/features/platform/lib/format'
import { FormField } from '@/features/platform/crm/components/FormField'
import { personName } from '@/features/platform/crm/lib/leadOptions'

export type MergeParty = {
  id: string
  firstName: string | null
  lastName: string | null
  primaryEmail: string | null
  primaryPhone: string | null
  leadsCount: number
  updatedAt: string
}

function PartyCard({ party, role }: { party: MergeParty; role: 'Keep' | 'Merge away' }) {
  return (
    <Panel className={`min-w-0 px-3 py-2.5 ${role === 'Keep' ? 'border-emerald-500/40' : 'border-red-500/30'}`}>
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{role}</p>
      <p className="text-sm font-medium">{personName(party.firstName, party.lastName)}</p>
      <p className="truncate text-xs text-muted-foreground">{[party.primaryEmail, formatPhone(party.primaryPhone)].filter(Boolean).join(' · ') || 'No contact'}</p>
      <p className="text-xs text-muted-foreground">{party.leadsCount} lead{party.leadsCount === 1 ? '' : 's'}</p>
    </Panel>
  )
}

export function MergeCustomerDialog({
  open,
  onOpenChange,
  current,
  candidate,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  current: MergeParty
  candidate: MergeParty | null
  onSubmit: (values: { survivor: MergeParty; duplicate: MergeParty; reason: string }) => Promise<string | null>
}) {
  const [survivorSide, setSurvivorSide] = useState<'current' | 'candidate'>('current')
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [errors, setErrors] = useState<{ reason?: string; confirmed?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const wasOpen = useRef(false)

  useEffect(() => {
    if (open && !wasOpen.current) {
      setSurvivorSide('current')
      setReason('')
      setConfirmed(false)
      setErrors({})
      setFormError(null)
    }
    wasOpen.current = open
  }, [open])

  if (!candidate) return null
  const survivor = survivorSide === 'current' ? current : candidate
  const duplicate = survivorSide === 'current' ? candidate : current

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const found = {
      reason: !reason.trim() ? 'Required' : reason.length > 1000 ? 'At most 1000 characters' : undefined,
      confirmed: confirmed ? undefined : 'Confirm the merge',
    }
    setErrors(found)
    if (found.reason || found.confirmed) return
    setBusy(true)
    setFormError(null)
    const error = await onSubmit({ survivor, duplicate, reason: reason.trim() })
    setBusy(false)
    if (error) setFormError(error)
  }

  return (
    <Dialog open={open} onOpenChange={next => { if (!busy) onOpenChange(next) }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Merge customers</DialogTitle>
          <DialogDescription>Cannot be undone</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Segmented
            label="Record to keep"
            value={survivorSide}
            onChange={setSurvivorSide}
            block
            options={[
              { value: 'current', label: 'Keep this record' },
              { value: 'candidate', label: 'Keep duplicate' },
            ]}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <PartyCard party={survivor} role="Keep" />
            <PartyCard party={duplicate} role="Merge away" />
          </div>
          <ul className="space-y-1 text-sm">
            <li>{duplicate.leadsCount} lead{duplicate.leadsCount === 1 ? '' : 's'} and all sales visits move to {personName(survivor.firstName, survivor.lastName)}</li>
            <li>Suppressions from either record are kept; consent stays only where both consented</li>
            <li>{personName(duplicate.firstName, duplicate.lastName)} becomes read only and marked merged</li>
          </ul>
          <FormField id="merge-reason" label="Reason" error={errors.reason}>
            <Textarea id="merge-reason" rows={3} maxLength={1000} value={reason} aria-invalid={Boolean(errors.reason)} onChange={event => { setReason(event.target.value); setErrors(prev => ({ ...prev, reason: undefined })) }} />
          </FormField>
          <div>
            <label className="flex min-h-11 items-center gap-3 rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <Checkbox className="size-5" checked={confirmed} onCheckedChange={checked => { setConfirmed(checked === true); setErrors(prev => ({ ...prev, confirmed: undefined })) }} />
              Merge {personName(duplicate.firstName, duplicate.lastName)} into {personName(survivor.firstName, survivor.lastName)}
            </label>
            {errors.confirmed && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.confirmed}</p>}
          </div>
          {formError && <Notice tone="bad">{formError}</Notice>}
          <DialogFooter className="sm:justify-end">
            <Track>
              <Pill variant="plain" className="h-11 sm:h-8" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Pill>
              <Pill type="submit" variant="danger" className="h-11 sm:h-8" disabled={busy}>{busy ? 'Merging…' : 'Merge'}</Pill>
            </Track>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
