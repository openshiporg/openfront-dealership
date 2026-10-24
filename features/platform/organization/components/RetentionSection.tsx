'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { Pencil } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Code, DeskSection, Notice, Panel, Pill, Segmented, TitleLine, Track, type DeskTone } from '@/features/platform/components/desk'
import { configureRetentionPolicy } from '../actions'
import { MAX_RETENTION_DAYS, RETENTION_CATEGORIES } from '../lib/permissions'
import type { RetentionPolicy, Rooftop, Viewer } from '../lib/types'
import { Field, FormDialog, fieldA11y, formatDate, newIdempotencyKey, type FieldErrors } from './FormDialog'

type Filter = 'all' | 'set' | 'unset' | 'hold'
type Row = { rooftop: Rooftop; category: { value: string; label: string }; policy: RetentionPolicy | null }
type FormState = { row: Row; retentionDays: string; legalHold: boolean; rationale: string; idempotencyKey: string }

function rowState(row: Row): { tone: DeskTone; label: string } {
  if (!row.policy) return { tone: 'idle', label: 'Not set' }
  if (row.policy.legalHold) return { tone: 'warn', label: 'Legal hold' }
  return { tone: 'ok', label: 'Set' }
}

function formatDays(days: number) {
  if (days % 365 === 0) return `${days / 365} ${days === 365 ? 'year' : 'years'}`
  return `${days} ${days === 1 ? 'day' : 'days'}`
}

export function RetentionSection({
  rooftops,
  policies,
  viewer,
  timeZone,
  error: loadError,
  onChanged,
}: {
  rooftops: Rooftop[]
  policies: RetentionPolicy[]
  viewer: Viewer | null
  timeZone: string
  error?: string
  onChanged: (message: string) => void
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const [form, setForm] = useState<FormState | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const canManage = Boolean(viewer?.canManageDealerships)

  const rows = useMemo(() => rooftops.flatMap(rooftop => RETENTION_CATEGORIES.map(category => ({
    rooftop,
    category,
    policy: policies.find(policy => policy.rooftop?.id === rooftop.id && policy.category === category.value) || null,
  }))), [rooftops, policies])

  const counts = {
    all: rows.length,
    set: rows.filter(row => row.policy).length,
    unset: rows.filter(row => !row.policy).length,
    hold: rows.filter(row => row.policy?.legalHold).length,
  }
  const matches = (row: Row) => filter === 'all' || (filter === 'set' ? Boolean(row.policy) : filter === 'unset' ? !row.policy : Boolean(row.policy?.legalHold))

  const blockedReason = (row: Row) => {
    if (!canManage) return 'Requires dealership administration permission'
    if (row.rooftop.status !== 'active') return 'Rooftop is not active'
    return undefined
  }

  const openForm = (row: Row) => {
    setFieldErrors({})
    setError(null)
    setForm({
      row,
      retentionDays: row.policy ? String(row.policy.retentionDays) : '',
      legalHold: row.policy?.legalHold ?? false,
      rationale: row.policy?.rationale ?? '',
      idempotencyKey: newIdempotencyKey(`retention:${row.rooftop.id}:${row.category.value}`),
    })
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form) return
    const daysText = form.retentionDays.trim().replace(/,/g, '')
    const retentionDays = Number(daysText)
    const rationale = form.rationale.trim()
    const errors: FieldErrors = {}
    if (!/^\d+$/.test(daysText) || retentionDays < 1 || retentionDays > MAX_RETENTION_DAYS) errors.retentionDays = `Whole number from 1 to ${MAX_RETENTION_DAYS.toLocaleString('en-US')}`
    if (!rationale) errors.rationale = 'Rationale is required'
    else if (rationale.length > 1000) errors.rationale = '1,000 characters or fewer'
    setFieldErrors(errors)
    if (Object.keys(errors).length) return
    setBusy(true)
    setError(null)
    const response = await configureRetentionPolicy({
      rooftopId: form.row.rooftop.id,
      category: form.row.category.value,
      retentionDays,
      legalHold: form.legalHold,
      rationale,
      idempotencyKey: form.idempotencyKey,
      expectedUpdatedAt: form.row.policy?.updatedAt ?? null,
    })
    setBusy(false)
    if (!response.success) { setError(response.error); return }
    setForm(null)
    onChanged('Retention policy saved')
  }

  if (loadError) return <Notice tone="bad">Retention policies unavailable: {loadError}</Notice>

  return (
    <div className="space-y-4">
      <Segmented<Filter>
        label="Filter retention policies"
        value={filter}
        onChange={setFilter}
        size="sm"
        options={[
          { value: 'all', label: 'All', count: counts.all },
          { value: 'set', label: 'Set', count: counts.set, tone: 'ok' },
          { value: 'unset', label: 'Not set', count: counts.unset, tone: 'idle' },
          { value: 'hold', label: 'Legal hold', count: counts.hold, tone: 'warn' },
        ]}
      />
      {!canManage && <p className="text-xs text-muted-foreground">Requires dealership administration permission</p>}

      {rooftops.length === 0 ? (
        <Panel className="px-4 py-12 text-center"><p className="text-sm text-muted-foreground">No rooftops</p></Panel>
      ) : (
        rooftops.map(rooftop => {
          const rooftopRows = rows.filter(row => row.rooftop.id === rooftop.id && matches(row))
          return (
            <DeskSection key={rooftop.id} title={<>{rooftop.name} <Code>{rooftop.code}</Code></>} count={rooftopRows.length}>
              {rooftopRows.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">No matching policies</p>
              ) : (
                <Panel className="divide-y">
                  {rooftopRows.map(row => {
                    const state = rowState(row)
                    const blocked = blockedReason(row)
                    return (
                      <div key={row.category.value} className="flex min-w-0 flex-col gap-3 px-4 py-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <TitleLine as="p" tone={state.tone} status={state.label} className="text-sm font-medium">
                            {row.category.label}
                          </TitleLine>
                          {row.policy ? (
                            <>
                              <p className="break-words pl-4 text-xs text-muted-foreground">
                                <span className="tabular-nums text-foreground">{formatDays(row.policy.retentionDays)}</span>
                                {row.policy.legalHold ? ' · Legal hold' : ''}
                                {` · ${row.policy.lastSweptAt ? `Swept ${formatDate(row.policy.lastSweptAt, timeZone)}` : 'Never swept'}`}
                                {` · Updated ${formatDate(row.policy.updatedAt, timeZone)}`}
                              </p>
                              {row.policy.rationale && <p className="break-words pl-4 text-xs text-muted-foreground">{row.policy.rationale}</p>}
                            </>
                          ) : (
                            <p className="pl-4 text-xs text-muted-foreground">Not set</p>
                          )}
                          {blocked && <p className="pl-4 text-xs text-muted-foreground">{blocked}</p>}
                        </div>
                        <Track className="self-end md:self-auto">
                          <Pill size="sm" variant={row.policy ? 'raised' : 'primary'} className="h-11 sm:h-7" disabled={Boolean(blocked)} title={blocked} onClick={() => openForm(row)}>
                            <Pencil />
                            {row.policy ? 'Edit' : 'Set policy'}
                          </Pill>
                        </Track>
                      </div>
                    )
                  })}
                </Panel>
              )}
            </DeskSection>
          )
        })
      )}

      <FormDialog
        open={Boolean(form)}
        title={form ? `${form.row.category.label}: ${form.row.rooftop.name}` : ''}
        error={error}
        busy={busy}
        onSubmit={submit}
        onOpenChange={open => { if (!open) setForm(null) }}
      >
        {form && (
          <div className="grid gap-4">
            <Field id="retention-days" label="Retention days" error={fieldErrors.retentionDays}>
              <Input {...fieldA11y('retention-days', fieldErrors.retentionDays)} className="h-11 sm:h-9" inputMode="numeric" value={form.retentionDays} onChange={event => setForm({ ...form, retentionDays: event.target.value })} />
            </Field>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <Checkbox checked={form.legalHold} onCheckedChange={value => setForm({ ...form, legalHold: value === true })} />
              Legal hold
            </label>
            {form.row.policy?.legalHold && !form.legalHold && <Notice tone="warn">Releasing the legal hold</Notice>}
            <Field id="retention-rationale" label="Rationale" error={fieldErrors.rationale}>
              <Textarea {...fieldA11y('retention-rationale', fieldErrors.rationale)} rows={3} maxLength={1000} value={form.rationale} onChange={event => setForm({ ...form, rationale: event.target.value })} />
            </Field>
          </div>
        )}
      </FormDialog>
    </div>
  )
}
