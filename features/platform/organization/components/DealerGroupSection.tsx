'use client'

import { useState, type FormEvent } from 'react'
import { Pencil } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { DeskSection, Facts, Notice, Panel, Pill, TitleLine, Track, type DeskTone } from '@/features/platform/components/desk'
import { updateDealerGroup } from '../actions'
import { SLUG_PATTERN } from '../lib/permissions'
import type { DealerGroup, RecordStatus, Viewer } from '../lib/types'
import { Field, FormDialog, fieldA11y, formatDate, type FieldErrors } from './FormDialog'

export const RECORD_STATUS: Record<RecordStatus, { label: string; tone: DeskTone }> = {
  active: { label: 'Active', tone: 'ok' },
  suspended: { label: 'Suspended', tone: 'warn' },
  archived: { label: 'Archived', tone: 'idle' },
}

type EditState = { group: DealerGroup; values: { name: string; slug: string; legalName: string } }
type StatusState = { group: DealerGroup; status: RecordStatus }

export function DealerGroupSection({
  groups,
  viewer,
  timeZone,
  onChanged,
}: {
  groups: DealerGroup[]
  viewer: Viewer | null
  timeZone: string
  onChanged: (message: string) => void
}) {
  const [edit, setEdit] = useState<EditState | null>(null)
  const [statusChange, setStatusChange] = useState<StatusState | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const canManage = Boolean(viewer?.canManageDealerships)
  const lockedReason = canManage ? undefined : 'Requires dealership administration permission'

  const openEdit = (group: DealerGroup) => {
    setFieldErrors({})
    setError(null)
    setEdit({ group, values: { name: group.name, slug: group.slug, legalName: group.legalName || '' } })
  }

  const submitEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!edit) return
    const name = edit.values.name.trim()
    const slug = edit.values.slug.trim()
    const legalName = edit.values.legalName.trim()
    const errors: FieldErrors = {}
    if (!name) errors.name = 'Name is required'
    else if (name.length > 200) errors.name = '200 characters or fewer'
    if (!SLUG_PATTERN.test(slug) || slug.length < 2 || slug.length > 120) errors.slug = 'Lowercase letters, numbers and single hyphens, 2-120 characters'
    if (legalName.length > 240) errors.legalName = '240 characters or fewer'
    setFieldErrors(errors)
    if (Object.keys(errors).length) return
    setBusy(true)
    setError(null)
    const response = await updateDealerGroup(edit.group.id, { name, slug, legalName })
    setBusy(false)
    if (!response.success) {
      setError(response.error)
      setFieldErrors(response.fieldErrors || {})
      return
    }
    setEdit(null)
    onChanged('Dealer group saved')
  }

  const submitStatus = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!statusChange) return
    setBusy(true)
    setError(null)
    const response = await updateDealerGroup(statusChange.group.id, { status: statusChange.status })
    setBusy(false)
    if (!response.success) { setError(response.error); return }
    setStatusChange(null)
    onChanged(`Dealer group ${RECORD_STATUS[statusChange.status].label.toLowerCase()}`)
  }

  if (!groups.length) {
    return (
      <Panel className="px-4 py-12 text-center">
        <p className="text-sm text-muted-foreground">No dealer group</p>
      </Panel>
    )
  }

  return (
    <div className="space-y-6">
      {groups.map(group => {
        const state = RECORD_STATUS[group.status] || RECORD_STATUS.active
        const transitions: Array<{ status: RecordStatus; label: string }> =
          group.status === 'active'
            ? [{ status: 'suspended', label: 'Suspend' }, { status: 'archived', label: 'Archive' }]
            : group.status === 'suspended'
              ? [{ status: 'active', label: 'Reactivate' }, { status: 'archived', label: 'Archive' }]
              : [{ status: 'active', label: 'Reactivate' }]
        return (
          <DeskSection
            key={group.id}
            title={<TitleLine as="span" tone={state.tone} status={state.label}>{group.name}</TitleLine>}
            actions={
              <Track>
                {transitions.map(transition => (
                  <Pill key={transition.status} size="sm" className="h-11 sm:h-7" disabled={!canManage} title={lockedReason} onClick={() => { setError(null); setStatusChange({ group, status: transition.status }) }}>
                    {transition.label}
                  </Pill>
                ))}
                <Pill size="sm" variant="primary" className="h-11 sm:h-7" disabled={!canManage} title={lockedReason} onClick={() => openEdit(group)}>
                  <Pencil />
                  Edit
                </Pill>
              </Track>
            }
          >
            <Panel className="px-4">
              <Facts
                items={[
                  { label: 'Status', value: state.label },
                  { label: 'Slug', value: group.slug, mono: true },
                  { label: 'Legal name', value: group.legalName || 'Not set' },
                  { label: 'Rooftops', value: group.rooftopsCount ?? 0, mono: true },
                  { label: 'Group members', value: group.membershipsCount ?? 0, mono: true },
                  group.createdAt ? { label: 'Created', value: formatDate(group.createdAt, timeZone) } : null,
                ]}
              />
            </Panel>
            {!canManage && <p className="mt-2 text-xs text-muted-foreground">{lockedReason}</p>}
          </DeskSection>
        )
      })}

      <FormDialog
        open={Boolean(edit)}
        title="Edit dealer group"
        error={error}
        busy={busy}
        onSubmit={submitEdit}
        onOpenChange={open => { if (!open) setEdit(null) }}
      >
        {edit && (
          <div className="grid gap-4">
            <Field id="group-name" label="Name" error={fieldErrors.name}>
              <Input {...fieldA11y('group-name', fieldErrors.name)} value={edit.values.name} maxLength={200} onChange={event => setEdit({ ...edit, values: { ...edit.values, name: event.target.value } })} />
            </Field>
            <Field id="group-slug" label="Slug" error={fieldErrors.slug}>
              <Input {...fieldA11y('group-slug', fieldErrors.slug)} value={edit.values.slug} maxLength={120} onChange={event => setEdit({ ...edit, values: { ...edit.values, slug: event.target.value.toLowerCase() } })} />
            </Field>
            <Field id="group-legal" label="Legal name" error={fieldErrors.legalName}>
              <Input {...fieldA11y('group-legal', fieldErrors.legalName)} value={edit.values.legalName} maxLength={240} onChange={event => setEdit({ ...edit, values: { ...edit.values, legalName: event.target.value } })} />
            </Field>
          </div>
        )}
      </FormDialog>

      <FormDialog
        open={Boolean(statusChange)}
        title={statusChange ? `${statusChange.status === 'active' ? 'Reactivate' : statusChange.status === 'suspended' ? 'Suspend' : 'Archive'} ${statusChange.group.name}` : ''}
        error={error}
        busy={busy}
        submitLabel={statusChange?.status === 'active' ? 'Reactivate' : statusChange?.status === 'suspended' ? 'Suspend' : 'Archive'}
        submitVariant={statusChange?.status === 'active' ? 'primary' : 'danger'}
        onSubmit={submitStatus}
        onOpenChange={open => { if (!open) setStatusChange(null) }}
      >
        {statusChange && statusChange.status !== 'active' && (
          <Notice tone="warn">Every rooftop in this group stops accepting operating changes</Notice>
        )}
      </FormDialog>
    </div>
  )
}
