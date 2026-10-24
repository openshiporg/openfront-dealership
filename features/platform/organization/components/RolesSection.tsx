'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Notice, Panel, Pill, Segmented, TitleLine, Track } from '@/features/platform/components/desk'
import { createRole, deleteRole, updateRole } from '../actions'
import { PERMISSION_GROUPS, PERMISSION_KEYS, roleIsTenantAssignable, rolePermissionCount } from '../lib/permissions'
import type { Role, Viewer } from '../lib/types'
import { Field, FormDialog, fieldA11y, type FieldErrors } from './FormDialog'

type Filter = 'all' | 'staff' | 'admin' | 'unused'
type FormState = { role: Role | null; name: string; flags: Record<string, boolean> }

function usage(role: Role) {
  return (role.assignedToCount ?? 0) + (role.dealerGroupMembershipsCount ?? 0) + (role.rooftopMembershipsCount ?? 0)
}

export function RolesSection({
  roles,
  viewer,
  error: loadError,
  onChanged,
}: {
  roles: Role[]
  viewer: Viewer | null
  error?: string
  onChanged: (message: string) => void
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<FormState | null>(null)
  const [removing, setRemoving] = useState<Role | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const canManage = Boolean(viewer?.canManageRoles)
  const lockedReason = canManage ? undefined : 'Requires role management permission'

  const counts = useMemo(() => ({
    all: roles.length,
    staff: roles.filter(roleIsTenantAssignable).length,
    admin: roles.filter(role => !roleIsTenantAssignable(role)).length,
    unused: roles.filter(role => usage(role) === 0).length,
  }), [roles])

  const term = search.trim().toLowerCase()
  const visible = roles
    .filter(role => filter === 'all' || (filter === 'staff' ? roleIsTenantAssignable(role) : filter === 'admin' ? !roleIsTenantAssignable(role) : usage(role) === 0))
    .filter(role => !term || role.name.toLowerCase().includes(term))

  const openForm = (role: Role | null) => {
    setFieldErrors({})
    setError(null)
    setForm({
      role,
      name: role?.name || '',
      flags: Object.fromEntries(PERMISSION_KEYS.map(key => [key, role ? role[key] === true : key === 'canAccessDashboard'])),
    })
  }

  const ownRole = form?.role && form.role.id === viewer?.roleId
  const losesAccess = Boolean(ownRole && form && (!form.flags.canManageRoles || !form.flags.canAccessDashboard))

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form) return
    const name = form.name.trim()
    const errors: FieldErrors = {}
    if (!name) errors.name = 'Name is required'
    else if (name.length > 200) errors.name = '200 characters or fewer'
    else if (roles.some(role => role.name.trim().toLowerCase() === name.toLowerCase() && role.id !== form.role?.id)) errors.name = 'Already in use'
    setFieldErrors(errors)
    if (Object.keys(errors).length) return
    setBusy(true)
    setError(null)
    const data = { name, ...form.flags }
    const response = form.role ? await updateRole(form.role.id, data) : await createRole(data)
    setBusy(false)
    if (!response.success) {
      setError(response.error)
      setFieldErrors(response.fieldErrors || {})
      return
    }
    setForm(null)
    onChanged(form.role ? 'Role saved' : 'Role created')
  }

  const submitRemove = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!removing) return
    setBusy(true)
    setError(null)
    const response = await deleteRole(removing.id)
    setBusy(false)
    if (!response.success) { setError(response.error); return }
    setRemoving(null)
    onChanged('Role deleted')
  }

  return (
    <div className="space-y-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented<Filter>
          label="Filter roles"
          value={filter}
          onChange={setFilter}
          size="sm"
          options={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'staff', label: 'Assignable', count: counts.staff },
            { value: 'admin', label: 'Admin', count: counts.admin },
            { value: 'unused', label: 'Unused', count: counts.unused },
          ]}
        />
        <Track>
          <Pill variant="primary" className="h-11 sm:h-8" disabled={!canManage} title={lockedReason} onClick={() => openForm(null)}>
            <Plus />
            New role
          </Pill>
        </Track>
      </div>
      {!canManage && <p className="text-xs text-muted-foreground">{lockedReason}</p>}
      <div className="relative min-w-0 sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="h-11 pl-9 sm:h-9" value={search} onChange={event => setSearch(event.target.value)} placeholder="Role name" aria-label="Search roles" />
      </div>

      {loadError ? (
        <Notice tone="bad">Roles unavailable: {loadError}</Notice>
      ) : visible.length === 0 ? (
        <Panel className="flex flex-col items-center gap-3 px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">{roles.length ? 'No matching roles' : 'No roles'}</p>
          {roles.length > 0 && <Track><Pill size="sm" onClick={() => { setSearch(''); setFilter('all') }}>Reset filters</Pill></Track>}
        </Panel>
      ) : (
        <Panel className="divide-y">
          {visible.map(role => {
            const assignable = roleIsTenantAssignable(role)
            const used = usage(role)
            const deleteBlocked = lockedReason || (used > 0 ? 'Role is in use' : role.id === viewer?.roleId ? 'This is your role' : undefined)
            return (
              <div key={role.id} className="flex min-w-0 flex-col gap-3 px-4 py-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <TitleLine as="p" tone={assignable ? 'info' : 'accent'} status={assignable ? 'Assignable' : 'Admin'} className="text-sm font-medium">
                    {role.name}
                  </TitleLine>
                  <p className="break-words pl-4 text-xs text-muted-foreground">
                    {assignable ? 'Assignable to memberships' : 'Admin permissions'} · {rolePermissionCount(role)} of {PERMISSION_KEYS.length} permissions
                  </p>
                  <p className="break-words pl-4 text-xs text-muted-foreground">
                    {role.assignedToCount ?? 0} users · {(role.dealerGroupMembershipsCount ?? 0) + (role.rooftopMembershipsCount ?? 0)} memberships
                  </p>
                </div>
                <Track className="self-end md:self-auto">
                  <Pill size="sm" className="h-11 sm:h-7" disabled={Boolean(deleteBlocked)} title={deleteBlocked} onClick={() => { setError(null); setRemoving(role) }} aria-label={`Delete ${role.name}`}>
                    <Trash2 />
                    Delete
                  </Pill>
                  <Pill size="sm" className="h-11 sm:h-7" onClick={() => openForm(role)} aria-label={`${canManage ? 'Edit' : 'View'} ${role.name}`}>
                    <Pencil />
                    {canManage ? 'Edit' : 'View'}
                  </Pill>
                </Track>
              </div>
            )
          })}
        </Panel>
      )}

      <FormDialog
        open={Boolean(form)}
        title={form?.role ? (canManage ? 'Edit role' : form.role.name) : 'New role'}
        error={error}
        busy={busy}
        submitLabel={form?.role ? 'Save' : 'Create'}
        submitDisabled={!canManage}
        onSubmit={submit}
        onOpenChange={open => { if (!open) setForm(null) }}
        wide
      >
        {form && (
          <div className="grid gap-4">
            <Field id="role-name" label="Name" error={fieldErrors.name}>
              <Input {...fieldA11y('role-name', fieldErrors.name)} className="h-11 sm:h-9" value={form.name} maxLength={200} disabled={!canManage} onChange={event => setForm({ ...form, name: event.target.value })} />
            </Field>
            {PERMISSION_GROUPS.map(group => (
              <fieldset key={group.title} className="min-w-0">
                <legend className="mb-1 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{group.title}</legend>
                <div className="grid gap-x-4 sm:grid-cols-2">
                  {group.flags.map(flag => (
                    <label key={flag.key} className="flex min-h-11 items-center gap-2 text-sm sm:min-h-9">
                      <Checkbox
                        checked={form.flags[flag.key] === true}
                        disabled={!canManage}
                        onCheckedChange={value => setForm({ ...form, flags: { ...form.flags, [flag.key]: value === true } })}
                      />
                      {flag.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            {!roleIsTenantAssignable(form.flags) && <Notice tone="info">Admin permissions: not assignable to memberships</Notice>}
            {losesAccess && <Notice tone="warn">This is your role; saving removes your own dashboard or role access</Notice>}
          </div>
        )}
      </FormDialog>

      <FormDialog
        open={Boolean(removing)}
        title={removing ? `Delete ${removing.name}` : ''}
        error={error}
        busy={busy}
        submitLabel="Delete"
        submitVariant="danger"
        onSubmit={submitRemove}
        onOpenChange={open => { if (!open) setRemoving(null) }}
      >
        <span className="sr-only">Confirm</span>
      </FormDialog>
    </div>
  )
}
