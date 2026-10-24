'use client'

import { useMemo, useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, KeyRound, Pencil, Plus, RefreshCw, Search } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import { Code, DeskHeader, Notice, Panel, Pill, Segmented, TitleLine, Track, type DeskTone } from '@/features/platform/components/desk'
import { dayKey } from '@/features/platform/lib/format'
import { Field, FormDialog, fieldA11y, formatDate, formatWhen, type FieldErrors } from '@/features/platform/organization/components/FormDialog'
import { createApiKey, setApiKeyStatus, updateApiKey } from '../actions'
import { API_KEY_SCOPES, endOfDayInZone, type ApiKey, type ApiKeyStatus, type ApiKeysData } from '../lib/scopes'

type Filter = 'active' | 'inactive' | 'expired' | 'revoked' | 'all'
type FormState = { key: ApiKey | null; name: string; scopes: string[]; expiresOn: string; ips: string }
type StatusChange = { key: ApiKey; status: ApiKeyStatus }

const SCOPE_LABEL = new Map(API_KEY_SCOPES.map(scope => [scope.value, scope.label]))

function isExpired(key: ApiKey) {
  return Boolean(key.expiresAt && Date.parse(key.expiresAt) <= Date.now())
}

function keyState(key: ApiKey): { tone: DeskTone; label: string; filter: Filter } {
  if (key.status === 'revoked') return { tone: 'idle', label: 'Revoked', filter: 'revoked' }
  if (isExpired(key)) return { tone: 'bad', label: 'Expired', filter: 'expired' }
  if (key.status === 'inactive') return { tone: 'warn', label: 'Inactive', filter: 'inactive' }
  return { tone: 'ok', label: 'Active', filter: 'active' }
}

function parseIps(text: string) {
  return [...new Set(text.split(/[\s,]+/).map(value => value.trim()).filter(Boolean))]
}

export function ApiKeysPageClient({ data, timeZone }: { data: ApiKeysData; timeZone: string }) {
  const router = useRouter()
  const [refreshing, startRefresh] = useTransition()
  const [filter, setFilter] = useState<Filter>('active')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<FormState | null>(null)
  const [statusChange, setStatusChange] = useState<StatusChange | null>(null)
  const [secret, setSecret] = useState<{ name: string; token: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = () => startRefresh(() => router.refresh())
  const grantable = new Set(data.grantableScopes)

  const counts = useMemo(() => {
    const result: Record<Filter, number> = { active: 0, inactive: 0, expired: 0, revoked: 0, all: data.keys.length }
    for (const key of data.keys) result[keyState(key).filter] += 1
    return result
  }, [data.keys])

  const term = search.trim().toLowerCase()
  const visible = data.keys
    .filter(key => filter === 'all' || keyState(key).filter === filter)
    .filter(key => !term || `${key.name} ${key.tokenPreview || ''} ${(key.scopes || []).join(' ')}`.toLowerCase().includes(term))

  const openForm = (key: ApiKey | null) => {
    setFieldErrors({})
    setError(null)
    setForm({
      key,
      name: key?.name || '',
      scopes: key?.scopes || [],
      expiresOn: key?.expiresAt ? dayKey(key.expiresAt, timeZone) : '',
      ips: (key?.restrictedToIPs || []).join('\n'),
    })
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form) return
    const errors: FieldErrors = {}
    const name = form.name.trim()
    if (!name) errors.name = 'Name is required'
    if (!form.scopes.length) errors.scopes = 'Choose at least one scope'
    let expiresAt: string | null = null
    if (form.expiresOn) {
      const at = endOfDayInZone(form.expiresOn, timeZone)
      if (!at || Number.isNaN(at.getTime())) errors.expiresAt = 'Enter a valid date'
      else if (at.getTime() <= Date.now()) errors.expiresAt = 'Must be in the future'
      else expiresAt = at.toISOString()
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length) return
    setBusy(true)
    setError(null)
    const input = { name, scopes: form.scopes, expiresAt, restrictedToIPs: parseIps(form.ips) }
    if (form.key) {
      const response = await updateApiKey(form.key.id, input)
      setBusy(false)
      if (!response.success) { setError(response.error); setFieldErrors(response.fieldErrors || {}); return }
      setForm(null)
      setNotice('API key saved')
      refresh()
      return
    }
    const response = await createApiKey(input)
    setBusy(false)
    if (!response.success) { setError(response.error); setFieldErrors(response.fieldErrors || {}); return }
    setForm(null)
    setCopied(false)
    setSecret({ name: response.data.key.name, token: response.data.token })
    refresh()
  }

  const submitStatus = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!statusChange) return
    setBusy(true)
    setError(null)
    const response = await setApiKeyStatus(statusChange.key.id, statusChange.status)
    setBusy(false)
    if (!response.success) { setError(response.error); return }
    setStatusChange(null)
    setNotice(statusChange.status === 'revoked' ? 'API key revoked' : statusChange.status === 'inactive' ? 'API key deactivated' : 'API key activated')
    refresh()
  }

  const copySecret = async () => {
    if (!secret) return
    try {
      await navigator.clipboard.writeText(secret.token)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'page' as const, label: 'Platform' },
    { type: 'page' as const, label: 'API keys' },
  ]

  const header = (
    <DeskHeader
      title="API keys"
      tone={data.error ? 'bad' : counts.expired ? 'warn' : counts.active ? 'ok' : 'idle'}
      status={data.error ? 'Unavailable' : `${counts.active} active`}
      meta={`${counts.active} active · ${counts.inactive} inactive · ${counts.expired} expired · ${counts.revoked} revoked`}
      actions={
        <Track>
          <Pill className="h-11 sm:h-8" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={refreshing ? 'animate-spin' : undefined} />
            Refresh
          </Pill>
          <Pill variant="primary" className="h-11 sm:h-8" onClick={() => openForm(null)} disabled={Boolean(data.error) || !data.grantableScopes.length} title={!data.grantableScopes.length ? 'Your permissions allow no API scopes' : undefined}>
            <Plus />
            New key
          </Pill>
        </Track>
      }
    />
  )

  return (
    <PageContainer title="API keys" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 max-w-full space-y-4 px-4 pb-24 md:px-6">
        {notice && (
          <Notice tone="ok">
            <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
              <p className="min-w-0">{notice}</p>
              <Track><Pill size="sm" variant="plain" onClick={() => setNotice(null)}>Dismiss</Pill></Track>
            </div>
          </Notice>
        )}
        {!data.error && !data.grantableScopes.length && <Notice tone="warn">Your permissions allow no API scopes</Notice>}
        <Segmented<Filter>
          label="Filter API keys"
          value={filter}
          onChange={setFilter}
          size="sm"
          options={[
            { value: 'active', label: 'Active', count: counts.active, tone: 'ok' },
            { value: 'inactive', label: 'Inactive', count: counts.inactive, tone: 'warn' },
            { value: 'expired', label: 'Expired', count: counts.expired, tone: 'bad' },
            { value: 'revoked', label: 'Revoked', count: counts.revoked, tone: 'idle' },
            { value: 'all', label: 'All', count: counts.all },
          ]}
        />
        <div className="relative min-w-0 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-11 pl-9 sm:h-9" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, prefix or scope" aria-label="Search API keys" />
        </div>

        {data.error ? (
          <Notice tone="bad">
            <p className="font-medium">API keys unavailable</p>
            <p className="mt-0.5 text-muted-foreground">{data.error}</p>
            <Track className="mt-2"><Pill size="sm" onClick={refresh}>Retry</Pill></Track>
          </Notice>
        ) : visible.length === 0 ? (
          <Panel className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <KeyRound className="size-5 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">{data.keys.length ? 'No matching API keys' : 'No API keys'}</p>
            {data.keys.length > 0 && <Track><Pill size="sm" onClick={() => { setSearch(''); setFilter('all') }}>Reset filters</Pill></Track>}
          </Panel>
        ) : (
          <Panel className="divide-y">
            {visible.map(key => {
              const state = keyState(key)
              const scopes = key.scopes || []
              const ips = key.restrictedToIPs || []
              return (
                <div key={key.id} className="flex min-w-0 flex-col gap-3 px-4 py-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <TitleLine as="p" tone={state.tone} status={state.label} className="text-sm font-medium">
                      {key.name} <Code>{key.tokenPreview || ''}</Code>
                    </TitleLine>
                    <p className="break-words pl-4 text-xs text-muted-foreground">
                      {scopes.length ? scopes.map(scope => SCOPE_LABEL.get(scope) || scope).join(' · ') : 'No scopes'}
                    </p>
                    <p className="break-words pl-4 text-xs text-muted-foreground">
                      {state.label}
                      {key.expiresAt ? ` · ${isExpired(key) ? 'Expired' : 'Expires'} ${formatDate(key.expiresAt, timeZone)}` : ' · No expiry'}
                      {` · ${key.lastUsedAt ? `Last used ${formatWhen(key.lastUsedAt, timeZone)}` : 'Never used'}`}
                      {` · ${key.usageCount?.total ?? 0} requests`}
                      {ips.length ? ` · ${ips.length === 1 ? ips[0] : `${ips.length} IPs`}` : ' · Any IP'}
                      {key.createdAt ? ` · Created ${formatDate(key.createdAt, timeZone)}` : ''}
                    </p>
                  </div>
                  {key.status !== 'revoked' && (
                    <Track className="self-end md:self-auto">
                      {key.status === 'active' ? (
                        <Pill size="sm" className="h-11 sm:h-7" onClick={() => { setError(null); setStatusChange({ key, status: 'inactive' }) }}>Deactivate</Pill>
                      ) : (
                        <Pill size="sm" className="h-11 sm:h-7" onClick={() => { setError(null); setStatusChange({ key, status: 'active' }) }}>Activate</Pill>
                      )}
                      <Pill size="sm" className="h-11 sm:h-7" onClick={() => { setError(null); setStatusChange({ key, status: 'revoked' }) }}>Revoke</Pill>
                      <Pill size="sm" className="h-11 sm:h-7" onClick={() => openForm(key)} aria-label={`Edit ${key.name}`}>
                        <Pencil />
                        Edit
                      </Pill>
                    </Track>
                  )}
                </div>
              )
            })}
          </Panel>
        )}
      </div>

      <FormDialog
        open={Boolean(form)}
        title={form?.key ? 'Edit API key' : 'New API key'}
        error={error}
        busy={busy}
        submitLabel={form?.key ? 'Save' : 'Create key'}
        onSubmit={submit}
        onOpenChange={open => { if (!open) setForm(null) }}
        wide
      >
        {form && (
          <div className="grid gap-4">
            <Field id="key-name" label="Name" error={fieldErrors.name}>
              <Input {...fieldA11y('key-name', fieldErrors.name)} className="h-11 sm:h-9" value={form.name} maxLength={200} placeholder="Inventory syndication" onChange={event => setForm({ ...form, name: event.target.value })} />
            </Field>
            <fieldset className="min-w-0" aria-describedby={fieldErrors.scopes ? 'key-scopes-error' : undefined}>
              <legend className="mb-1 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Scopes</legend>
              <div className="grid gap-x-4 sm:grid-cols-2">
                {API_KEY_SCOPES.map(scope => {
                  const allowed = grantable.has(scope.value)
                  const checked = form.scopes.includes(scope.value)
                  return (
                    <label key={scope.value} className={`flex min-h-11 items-start gap-2 py-1 text-sm sm:min-h-9 ${allowed ? '' : 'text-muted-foreground'}`}>
                      <Checkbox
                        className="mt-0.5"
                        checked={checked}
                        disabled={!allowed && !checked}
                        onCheckedChange={value => setForm({ ...form, scopes: value === true ? [...form.scopes, scope.value] : form.scopes.filter(item => item !== scope.value) })}
                      />
                      <span className="min-w-0">
                        {scope.label}
                        <span className="block font-mono text-[11px] text-muted-foreground">{scope.value}{allowed ? '' : ' · not in your permissions'}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
              {fieldErrors.scopes && <p id="key-scopes-error" className="mt-1 text-xs text-red-700 dark:text-red-300">{fieldErrors.scopes}</p>}
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="key-expires" label="Expires" error={fieldErrors.expiresAt} hint="Blank for no expiry">
                <Input {...fieldA11y('key-expires', fieldErrors.expiresAt)} className="h-11 sm:h-9" type="date" value={form.expiresOn} onChange={event => setForm({ ...form, expiresOn: event.target.value })} />
              </Field>
              <Field id="key-ips" label="Allowed IPs" error={fieldErrors.restrictedToIPs} hint="One per line; blank for any">
                <Textarea {...fieldA11y('key-ips', fieldErrors.restrictedToIPs)} rows={3} className="font-mono text-sm" value={form.ips} onChange={event => setForm({ ...form, ips: event.target.value })} />
              </Field>
            </div>
          </div>
        )}
      </FormDialog>

      <FormDialog
        open={Boolean(statusChange)}
        title={statusChange ? `${statusChange.status === 'revoked' ? 'Revoke' : statusChange.status === 'inactive' ? 'Deactivate' : 'Activate'} ${statusChange.key.name}` : ''}
        error={error}
        busy={busy}
        submitLabel={statusChange?.status === 'revoked' ? 'Revoke' : statusChange?.status === 'inactive' ? 'Deactivate' : 'Activate'}
        submitVariant={statusChange?.status === 'active' ? 'primary' : 'danger'}
        onSubmit={submitStatus}
        onOpenChange={open => { if (!open) setStatusChange(null) }}
      >
        {statusChange?.status === 'revoked' && <Notice tone="warn">Revoked keys cannot be reactivated</Notice>}
        {statusChange?.status === 'active' && isExpired(statusChange.key) && <Notice tone="warn">Expired; requests stay refused until the expiry is changed</Notice>}
      </FormDialog>

      <Dialog open={Boolean(secret)} onOpenChange={open => { if (!open) setSecret(null) }}>
        <DialogContent className="sm:max-w-lg" onInteractOutside={event => event.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{secret?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Notice tone="warn">Shown once. Copy it now.</Notice>
            <label htmlFor="api-key-secret" className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Secret</label>
            <Input id="api-key-secret" readOnly value={secret?.token || ''} className="h-11 font-mono text-xs" onFocus={event => event.currentTarget.select()} />
          </div>
          <DialogFooter className="sm:justify-end">
            <Track>
              <Pill className="h-11 sm:h-8" onClick={copySecret}>
                {copied ? <Check /> : <Copy />}
                {copied ? 'Copied' : 'Copy'}
              </Pill>
              <Pill variant="primary" className="h-11 sm:h-8" onClick={() => setSecret(null)}>Done</Pill>
            </Track>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
