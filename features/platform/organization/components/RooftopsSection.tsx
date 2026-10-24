'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { Pencil, Plus, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Code, Notice, Panel, Pill, Segmented, TitleLine, Track } from '@/features/platform/components/desk'
import { createRooftop, updateRooftop } from '../actions'
import { SLUG_PATTERN, US_TIME_ZONES, isValidTimeZone } from '../lib/permissions'
import type { DealerGroup, RecordStatus, Rooftop, Viewer } from '../lib/types'
import { RECORD_STATUS } from './DealerGroupSection'
import { Field, FormDialog, fieldA11y, type FieldErrors } from './FormDialog'

type Filter = RecordStatus | 'all'
type FormValues = { dealerGroupId: string; code: string; name: string; publicSlug: string; timezone: string }
type FormState = { mode: 'create' } | { mode: 'edit'; rooftop: Rooftop }

function timeZoneLabel(zone: string) {
  return zone.replace(/^America\//, '').replace(/^Pacific\//, '').replace(/_/g, ' ')
}

export function RooftopsSection({
  rooftops,
  groups,
  viewer,
  onChanged,
}: {
  rooftops: Rooftop[]
  groups: DealerGroup[]
  viewer: Viewer | null
  onChanged: (message: string) => void
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<FormState | null>(null)
  const [values, setValues] = useState<FormValues>({ dealerGroupId: '', code: '', name: '', publicSlug: '', timezone: 'America/New_York' })
  const [statusChange, setStatusChange] = useState<{ rooftop: Rooftop; status: RecordStatus } | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const canManage = Boolean(viewer?.canManageDealerships)
  const lockedReason = canManage ? undefined : 'Requires dealership administration permission'

  const counts = useMemo(() => ({
    all: rooftops.length,
    active: rooftops.filter(rooftop => rooftop.status === 'active').length,
    suspended: rooftops.filter(rooftop => rooftop.status === 'suspended').length,
    archived: rooftops.filter(rooftop => rooftop.status === 'archived').length,
  }), [rooftops])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rooftops
      .filter(rooftop => filter === 'all' || rooftop.status === filter)
      .filter(rooftop => !term || `${rooftop.name} ${rooftop.code} ${rooftop.publicSlug}`.toLowerCase().includes(term))
  }, [rooftops, filter, search])

  const zones = (current: string) => (current && !US_TIME_ZONES.includes(current) ? [current, ...US_TIME_ZONES] : US_TIME_ZONES)

  const openCreate = () => {
    setFieldErrors({})
    setError(null)
    setValues({ dealerGroupId: groups.length === 1 ? groups[0].id : '', code: '', name: '', publicSlug: '', timezone: 'America/New_York' })
    setForm({ mode: 'create' })
  }

  const openEdit = (rooftop: Rooftop) => {
    setFieldErrors({})
    setError(null)
    setValues({ dealerGroupId: rooftop.dealerGroup?.id || '', code: rooftop.code, name: rooftop.name, publicSlug: rooftop.publicSlug, timezone: rooftop.timezone })
    setForm({ mode: 'edit', rooftop })
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form) return
    const code = values.code.trim().toUpperCase()
    const name = values.name.trim()
    const publicSlug = values.publicSlug.trim()
    const errors: FieldErrors = {}
    if (form.mode === 'create') {
      if (!values.dealerGroupId) errors.dealerGroup = 'Dealer group is required'
      if (!code) errors.code = 'Code is required'
      else if (code.length > 40) errors.code = '40 characters or fewer'
      else if (rooftops.some(rooftop => rooftop.dealerGroup?.id === values.dealerGroupId && rooftop.code === code)) errors.code = 'Already in use in this group'
    }
    if (!name) errors.name = 'Name is required'
    else if (name.length > 200) errors.name = '200 characters or fewer'
    if (!SLUG_PATTERN.test(publicSlug) || publicSlug.length < 2 || publicSlug.length > 120) errors.publicSlug = 'Lowercase letters, numbers and single hyphens, 2-120 characters'
    else if (rooftops.some(rooftop => rooftop.publicSlug === publicSlug && (form.mode === 'create' || rooftop.id !== form.rooftop.id))) errors.publicSlug = 'Already in use'
    if (!isValidTimeZone(values.timezone)) errors.timezone = 'Choose a time zone'
    setFieldErrors(errors)
    if (Object.keys(errors).length) return
    setBusy(true)
    setError(null)
    const response = form.mode === 'create'
      ? await createRooftop({ dealerGroupId: values.dealerGroupId, code, name, publicSlug, timezone: values.timezone })
      : await updateRooftop(form.rooftop.id, { name, publicSlug, timezone: values.timezone })
    setBusy(false)
    if (!response.success) {
      setError(response.error)
      const serverErrors = { ...(response.fieldErrors || {}) }
      if (serverErrors.rooftopKey) serverErrors.code = 'Already in use in this group'
      setFieldErrors(serverErrors)
      return
    }
    setForm(null)
    onChanged(form.mode === 'create' ? 'Rooftop created' : 'Rooftop saved')
  }

  const submitStatus = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!statusChange) return
    setBusy(true)
    setError(null)
    const response = await updateRooftop(statusChange.rooftop.id, { status: statusChange.status })
    setBusy(false)
    if (!response.success) { setError(response.error); return }
    setStatusChange(null)
    onChanged(`Rooftop ${RECORD_STATUS[statusChange.status].label.toLowerCase()}`)
  }

  const verb = (status: RecordStatus) => (status === 'active' ? 'Reactivate' : status === 'suspended' ? 'Suspend' : 'Archive')

  return (
    <div className="space-y-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented<Filter>
          label="Filter rooftops"
          value={filter}
          onChange={setFilter}
          size="sm"
          options={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'active', label: 'Active', count: counts.active, tone: 'ok' },
            { value: 'suspended', label: 'Suspended', count: counts.suspended, tone: 'warn' },
            { value: 'archived', label: 'Archived', count: counts.archived, tone: 'idle' },
          ]}
        />
        <Track>
          <Pill variant="primary" className="h-11 sm:h-8" disabled={!canManage || !groups.length} title={!groups.length ? 'No dealer group' : lockedReason} onClick={openCreate}>
            <Plus />
            New rooftop
          </Pill>
        </Track>
      </div>
      {!canManage && <p className="text-xs text-muted-foreground">{lockedReason}</p>}
      <div className="relative min-w-0 sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="h-11 pl-9 sm:h-9" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, code or slug" aria-label="Search rooftops" />
      </div>

      {visible.length === 0 ? (
        <Panel className="flex flex-col items-center gap-3 px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">{rooftops.length ? 'No matching rooftops' : 'No rooftops'}</p>
          {rooftops.length > 0 && (
            <Track><Pill size="sm" onClick={() => { setSearch(''); setFilter('all') }}>Reset filters</Pill></Track>
          )}
        </Panel>
      ) : (
        <Panel className="divide-y">
          {visible.map(rooftop => {
            const state = RECORD_STATUS[rooftop.status] || RECORD_STATUS.active
            const transitions: RecordStatus[] = rooftop.status === 'active' ? ['suspended', 'archived'] : rooftop.status === 'suspended' ? ['active', 'archived'] : ['active']
            return (
              <div key={rooftop.id} className="flex min-w-0 flex-col gap-3 px-4 py-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <TitleLine as="p" tone={state.tone} status={state.label} className="text-sm font-medium">
                    {rooftop.name} <Code>{rooftop.code}</Code>
                  </TitleLine>
                  <p className="break-words pl-4 text-xs text-muted-foreground">
                    {state.label} · {rooftop.dealerGroup?.name || 'No group'} · /{rooftop.publicSlug} · {timeZoneLabel(rooftop.timezone)} · {rooftop.currencyCode} · {rooftop.membershipsCount ?? 0} members
                  </p>
                </div>
                <Track className="self-end md:self-auto">
                  {transitions.map(status => (
                    <Pill key={status} size="sm" className="h-11 sm:h-7" disabled={!canManage} title={lockedReason} onClick={() => { setError(null); setStatusChange({ rooftop, status }) }}>
                      {verb(status)}
                    </Pill>
                  ))}
                  <Pill size="sm" className="h-11 sm:h-7" disabled={!canManage} title={lockedReason} onClick={() => openEdit(rooftop)} aria-label={`Edit ${rooftop.name}`}>
                    <Pencil />
                    Edit
                  </Pill>
                </Track>
              </div>
            )
          })}
        </Panel>
      )}

      <FormDialog
        open={Boolean(form)}
        title={form?.mode === 'create' ? 'New rooftop' : 'Edit rooftop'}
        error={error}
        busy={busy}
        submitLabel={form?.mode === 'create' ? 'Create' : 'Save'}
        onSubmit={submit}
        onOpenChange={open => { if (!open) setForm(null) }}
      >
        {form && (
          <div className="grid gap-4 sm:grid-cols-2">
            {form.mode === 'create' ? (
              <Field id="rooftop-group" label="Dealer group" error={fieldErrors.dealerGroup} className="sm:col-span-2">
                <Select value={values.dealerGroupId} onValueChange={value => setValues({ ...values, dealerGroupId: value })}>
                  <SelectTrigger {...fieldA11y('rooftop-group', fieldErrors.dealerGroup)} className="h-11 sm:h-9"><SelectValue placeholder="Select dealer group" /></SelectTrigger>
                  <SelectContent>{groups.map(group => <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            ) : null}
            <Field id="rooftop-code" label="Code" error={fieldErrors.code} hint={form.mode === 'edit' ? 'Fixed after creation' : undefined}>
              <Input {...fieldA11y('rooftop-code', fieldErrors.code)} className="h-11 font-mono uppercase sm:h-9" value={values.code} maxLength={40} disabled={form.mode === 'edit'} onChange={event => setValues({ ...values, code: event.target.value.toUpperCase() })} />
            </Field>
            <Field id="rooftop-name" label="Name" error={fieldErrors.name}>
              <Input {...fieldA11y('rooftop-name', fieldErrors.name)} className="h-11 sm:h-9" value={values.name} maxLength={200} onChange={event => setValues({ ...values, name: event.target.value })} />
            </Field>
            <Field id="rooftop-slug" label="Storefront slug" error={fieldErrors.publicSlug}>
              <Input {...fieldA11y('rooftop-slug', fieldErrors.publicSlug)} className="h-11 sm:h-9" value={values.publicSlug} maxLength={120} onChange={event => setValues({ ...values, publicSlug: event.target.value.toLowerCase() })} />
            </Field>
            <Field id="rooftop-timezone" label="Time zone" error={fieldErrors.timezone}>
              <Select value={values.timezone} onValueChange={value => setValues({ ...values, timezone: value })}>
                <SelectTrigger {...fieldA11y('rooftop-timezone', fieldErrors.timezone)} className="h-11 sm:h-9"><SelectValue placeholder="Select time zone" /></SelectTrigger>
                <SelectContent>{zones(values.timezone).map(zone => <SelectItem key={zone} value={zone}>{timeZoneLabel(zone)}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field id="rooftop-currency" label="Currency" hint="USD only">
              <Input id="rooftop-currency" className="h-11 font-mono sm:h-9" value={form.mode === 'edit' ? form.rooftop.currencyCode : 'USD'} disabled readOnly />
            </Field>
          </div>
        )}
      </FormDialog>

      <FormDialog
        open={Boolean(statusChange)}
        title={statusChange ? `${verb(statusChange.status)} ${statusChange.rooftop.name}` : ''}
        error={error}
        busy={busy}
        submitLabel={statusChange ? verb(statusChange.status) : 'Save'}
        submitVariant={statusChange?.status === 'active' ? 'primary' : 'danger'}
        onSubmit={submitStatus}
        onOpenChange={open => { if (!open) setStatusChange(null) }}
      >
        {statusChange && statusChange.status !== 'active' && (
          <Notice tone="warn">Inventory and operating changes stop at this rooftop</Notice>
        )}
      </FormDialog>
    </div>
  )
}
