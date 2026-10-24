'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import { Code, DeskHeader, Notice, Panel, Pill, Readout, ReadoutStrip, Segmented, TitleLine, Track } from '@/features/platform/components/desk'
import { recordReference } from '@/features/platform/lib/format'

import {
  configureAccountingMapping,
  deleteAccountingMapping,
  getAccountingBatches,
  getAccountingMappings,
  getStageSources,
  stageAccountingBatch,
} from '../actions'
import { CommandDialog, type CommandField, type FieldErrors } from '../components/CommandDialog'
import {
  ACCOUNTING_PROVIDER,
  BATCH_STATUSES,
  BATCH_STATUS_LABEL,
  SOURCE_CODES,
  SOURCE_TYPES,
  SOURCE_TYPE_LABEL,
  batchTone,
  dateTime,
  money,
  nonce,
  type AccountingSourceType,
} from '../lib/format'
import type { AccountingBatchListItem, AccountingMappingRecord, BatchCounts, RooftopOption, StageSourceOption } from '../lib/types'

type View = 'batches' | 'mappings'
type MappingForm = { mode: 'create' | 'edit'; values: Record<string, string> }

const EMPTY_COUNTS: BatchCounts = { all: 0, staged: 0, posting: 0, failed: 0, posted: 0, reconciled: 0, locked: 0 }

export function AccountingPageClient({
  timeZone,
  initialBatches,
  initialCounts,
  initialBatchError,
  initialMappings,
  rooftops,
  initialMappingError,
}: {
  timeZone: string
  initialBatches: AccountingBatchListItem[]
  initialCounts: BatchCounts | null
  initialBatchError: string | null
  initialMappings: AccountingMappingRecord[]
  rooftops: RooftopOption[]
  initialMappingError: string | null
}) {
  const router = useRouter()
  const [view, setView] = useState<View>('batches')
  const [message, setMessage] = useState<string | null>(null)

  // Batches
  const [batches, setBatches] = useState(initialBatches)
  const [counts, setCounts] = useState<BatchCounts>(initialCounts ?? EMPTY_COUNTS)
  const [batchError, setBatchError] = useState(initialBatchError)
  const [batchLoading, setBatchLoading] = useState(false)
  const [status, setStatus] = useState('all')
  const [sourceType, setSourceType] = useState('all')
  const [search, setSearch] = useState('')
  const firstLoad = useRef(true)

  const loadBatches = useCallback(async (filters: { status: string; sourceType: string; search: string }) => {
    setBatchLoading(true)
    const result = await getAccountingBatches(filters)
    if (result.success) {
      setBatches(result.data.batches)
      setCounts(result.data.counts)
      setBatchError(null)
    } else {
      setBatchError(result.error)
    }
    setBatchLoading(false)
  }, [])

  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false
      return
    }
    const timer = setTimeout(() => loadBatches({ status, sourceType, search }), search ? 250 : 0)
    return () => clearTimeout(timer)
  }, [status, sourceType, search, loadBatches])

  // Mappings
  const [mappings, setMappings] = useState(initialMappings)
  const [mappingError, setMappingError] = useState(initialMappingError)
  const [mappingType, setMappingType] = useState<'all' | AccountingSourceType>('all')
  const [mappingRooftop, setMappingRooftop] = useState('all')
  const [mappingForm, setMappingForm] = useState<MappingForm | null>(null)
  const [mappingFieldErrors, setMappingFieldErrors] = useState<FieldErrors>({})
  const [mappingSubmitError, setMappingSubmitError] = useState<string | null>(null)
  const [mappingBusy, setMappingBusy] = useState(false)
  const [deleting, setDeleting] = useState<AccountingMappingRecord | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const loadMappings = useCallback(async () => {
    const result = await getAccountingMappings()
    if (result.success) {
      setMappings(result.data.accountingMappings || [])
      setMappingError(null)
    } else {
      setMappingError(result.error)
    }
  }, [])

  // Stage
  const [stageOpen, setStageOpen] = useState(false)
  const [stageValues, setStageValues] = useState<Record<string, string>>({ sourceType: 'deal', sourceId: '' })
  const [stageOptions, setStageOptions] = useState<StageSourceOption[]>([])
  const [stageOptionsState, setStageOptionsState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [stageFieldErrors, setStageFieldErrors] = useState<FieldErrors>({})
  const [stageError, setStageError] = useState<string | null>(null)
  const [stageBusy, setStageBusy] = useState(false)

  const loadStageOptions = useCallback(async (type: string) => {
    setStageOptionsState('loading')
    setStageOptions([])
    const result = await getStageSources(type)
    if (result.success) {
      setStageOptions(result.data)
      setStageOptionsState('idle')
    } else {
      setStageOptionsState('error')
    }
  }, [])

  const openStage = () => {
    setStageValues({ sourceType: 'deal', sourceId: '' })
    setStageFieldErrors({})
    setStageError(null)
    setStageOpen(true)
    loadStageOptions('deal')
  }

  const changeStage = (values: Record<string, string>) => {
    if (values.sourceType !== stageValues.sourceType) {
      setStageValues({ sourceType: values.sourceType, sourceId: '' })
      loadStageOptions(values.sourceType)
    } else {
      setStageValues(values)
    }
    setStageFieldErrors({})
  }

  const submitStage = async () => {
    const errors: FieldErrors = {}
    if (!stageValues.sourceType) errors.sourceType = 'Choose a source type'
    if (!stageValues.sourceId) errors.sourceId = 'Choose a source record'
    setStageFieldErrors(errors)
    if (Object.keys(errors).length) return
    setStageBusy(true)
    setStageError(null)
    const result = await stageAccountingBatch({ sourceType: stageValues.sourceType, sourceId: stageValues.sourceId, providerKey: ACCOUNTING_PROVIDER, idempotencyKey: nonce('accounting-stage') })
    setStageBusy(false)
    if (!result.success) {
      setStageError(result.error)
      return
    }
    setStageOpen(false)
    router.push(`${basePath}/platform/accounting/${result.data.stageAccountingBatch.id}`)
  }

  const stageFields: CommandField[] = [
    { name: 'sourceType', label: 'Source type', type: 'select', options: SOURCE_TYPES.map(value => ({ value, label: SOURCE_TYPE_LABEL[value] })) },
    {
      name: 'sourceId',
      label: 'Source record',
      type: 'select',
      wide: true,
      disabled: stageOptionsState === 'loading' || stageOptions.length === 0,
      placeholder: stageOptionsState === 'loading' ? 'Loading…' : stageOptionsState === 'error' ? 'Sources unavailable' : stageOptions.length === 0 ? 'No eligible records' : 'Select a record',
      options: stageOptions.map(option => ({ value: option.id, label: [option.label, option.detail, option.rooftop].filter(Boolean).join(' · ') })),
    },
  ]

  // Mapping form
  const openMappingCreate = () => {
    const rooftopId = mappingRooftop !== 'all' ? mappingRooftop : rooftops[0]?.id || ''
    const type = mappingType !== 'all' ? mappingType : 'deal'
    setMappingForm({ mode: 'create', values: { rooftopId, sourceType: type, sourceCode: SOURCE_CODES[type][0], debitAccount: '', creditAccount: '' } })
    setMappingFieldErrors({})
    setMappingSubmitError(null)
  }

  const openMappingEdit = (mapping: AccountingMappingRecord) => {
    setMappingForm({
      mode: 'edit',
      values: { rooftopId: mapping.rooftop?.id || '', sourceType: mapping.sourceType, sourceCode: mapping.sourceCode, debitAccount: mapping.debitAccount, creditAccount: mapping.creditAccount },
    })
    setMappingFieldErrors({})
    setMappingSubmitError(null)
  }

  const changeMapping = (values: Record<string, string>) => {
    setMappingForm(current => {
      if (!current) return current
      const next = { ...values }
      if (values.sourceType !== current.values.sourceType) next.sourceCode = SOURCE_CODES[values.sourceType as AccountingSourceType]?.[0] || ''
      return { ...current, values: next }
    })
    setMappingFieldErrors({})
  }

  const submitMapping = async () => {
    if (!mappingForm) return
    const values = mappingForm.values
    const errors: FieldErrors = {}
    if (!values.rooftopId) errors.rooftopId = 'Choose a rooftop'
    if (!values.sourceType) errors.sourceType = 'Choose a source type'
    if (!values.sourceCode) errors.sourceCode = 'Choose a source code'
    const debit = (values.debitAccount || '').trim()
    const credit = (values.creditAccount || '').trim()
    if (!debit) errors.debitAccount = 'Debit account is required'
    else if (debit.length > 100) errors.debitAccount = 'Up to 100 characters'
    if (!credit) errors.creditAccount = 'Credit account is required'
    else if (credit.length > 100) errors.creditAccount = 'Up to 100 characters'
    if (debit && credit && debit === credit) errors.creditAccount = 'Must differ from the debit account'
    if (mappingForm.mode === 'create' && mappings.some(m => m.rooftop?.id === values.rooftopId && m.sourceType === values.sourceType && m.sourceCode === values.sourceCode)) {
      errors.sourceCode = 'A mapping for this code exists; edit it instead'
    }
    setMappingFieldErrors(errors)
    if (Object.keys(errors).length) return
    setMappingBusy(true)
    setMappingSubmitError(null)
    const result = await configureAccountingMapping({
      rooftopId: values.rooftopId,
      sourceType: values.sourceType,
      sourceCode: values.sourceCode,
      debitAccount: debit,
      creditAccount: credit,
      providerKey: ACCOUNTING_PROVIDER,
      idempotencyKey: nonce('accounting-mapping'),
    })
    setMappingBusy(false)
    if (!result.success) {
      setMappingSubmitError(result.error)
      return
    }
    setMappingForm(null)
    setMessage(mappingForm.mode === 'create' ? 'Mapping added.' : 'Mapping updated.')
    await loadMappings()
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setDeleteBusy(true)
    setDeleteError(null)
    const result = await deleteAccountingMapping(deleting.id)
    setDeleteBusy(false)
    if (!result.success) {
      setDeleteError(result.error)
      return
    }
    setDeleting(null)
    setMessage('Mapping deleted.')
    await loadMappings()
  }

  const mappingFields: CommandField[] = mappingForm
    ? [
        { name: 'rooftopId', label: 'Rooftop', type: 'select', disabled: mappingForm.mode === 'edit', options: rooftops.map(r => ({ value: r.id, label: r.name })), placeholder: rooftops.length ? 'Select a rooftop' : 'No rooftops' },
        { name: 'sourceType', label: 'Source type', type: 'select', disabled: mappingForm.mode === 'edit', options: SOURCE_TYPES.map(value => ({ value, label: SOURCE_TYPE_LABEL[value] })) },
        {
          name: 'sourceCode',
          label: 'Source code',
          type: 'select',
          wide: true,
          disabled: mappingForm.mode === 'edit',
          options: (SOURCE_CODES[mappingForm.values.sourceType as AccountingSourceType] || []).map(code => ({ value: code, label: code })),
        },
        { name: 'debitAccount', label: 'Debit account', maxLength: 100, placeholder: '1010 Cash' },
        { name: 'creditAccount', label: 'Credit account', maxLength: 100, placeholder: '4010 Vehicle sales' },
      ]
    : []

  const filteredMappings = useMemo(
    () => mappings.filter(m => (mappingType === 'all' || m.sourceType === mappingType) && (mappingRooftop === 'all' || m.rooftop?.id === mappingRooftop)),
    [mappings, mappingType, mappingRooftop],
  )

  const missingCodes = useMemo(() => {
    const scope = mappingRooftop !== 'all' ? rooftops.filter(r => r.id === mappingRooftop) : rooftops
    const missing: string[] = []
    for (const rooftop of scope) {
      for (const type of SOURCE_TYPES) {
        if (mappingType !== 'all' && mappingType !== type) continue
        for (const code of SOURCE_CODES[type]) {
          if (!mappings.some(m => m.rooftop?.id === rooftop.id && m.sourceType === type && m.sourceCode === code)) missing.push(`${scope.length > 1 ? `${rooftop.name}: ` : ''}${type}/${code}`)
        }
      }
    }
    return missing
  }, [mappings, rooftops, mappingRooftop, mappingType])

  const refresh = async () => {
    await Promise.all([loadBatches({ status, sourceType, search }), loadMappings()])
  }

  const needsAction = counts.staged + counts.posting + counts.failed
  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'page' as const, label: 'Platform' },
    { type: 'page' as const, label: 'Accounting' },
  ]
  const filtered = Boolean(search.trim()) || status !== 'all' || sourceType !== 'all'

  const header = (
    <DeskHeader
      title="Accounting"
      tone={batchError ? 'bad' : counts.failed > 0 ? 'bad' : needsAction > 0 ? 'warn' : 'ok'}
      status={batchError ? 'Unavailable' : counts.failed > 0 ? `${counts.failed} failed` : needsAction > 0 ? `${needsAction} open` : 'Clear'}
      meta={`${counts.all} batches · ${mappings.length} mappings`}
      actions={
        <Track>
          <Pill onClick={refresh} disabled={batchLoading} aria-label="Refresh" className="h-11 sm:h-8">
            <RefreshCw className={batchLoading ? 'animate-spin' : undefined} />
            Refresh
          </Pill>
          {view === 'batches' ? (
            <Pill variant="primary" onClick={openStage} className="h-11 sm:h-8">
              <Plus />
              Stage batch
            </Pill>
          ) : (
            <Pill variant="primary" onClick={openMappingCreate} disabled={rooftops.length === 0} className="h-11 sm:h-8">
              <Plus />
              Add mapping
            </Pill>
          )}
        </Track>
      }
    />
  )

  return (
    <PageContainer title="Accounting" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 max-w-full space-y-6 px-4 pb-24 md:px-6">
        {message && (
          <Notice tone="ok">
            <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
              <p className="min-w-0">{message}</p>
              <Track>
                <Pill size="sm" variant="plain" onClick={() => setMessage(null)}>Dismiss</Pill>
              </Track>
            </div>
          </Notice>
        )}

        <Segmented<View>
          label="Accounting view"
          value={view}
          onChange={setView}
          options={[
            { value: 'batches', label: 'Batches', count: counts.all },
            { value: 'mappings', label: 'Mappings', count: mappings.length },
          ]}
        />

        {view === 'batches' ? (
          <div className="space-y-4">
            <ReadoutStrip>
              <Readout label="Staged" value={counts.staged} tone={counts.staged ? 'warn' : 'idle'} />
              <Readout label="Posting" value={counts.posting} tone={counts.posting ? 'warn' : 'idle'} />
              <Readout label="Failed" value={counts.failed} tone={counts.failed ? 'bad' : 'idle'} />
              <Readout label="Locked" value={counts.locked} tone={counts.locked ? 'ok' : 'idle'} />
            </ReadoutStrip>

            <div className="flex min-w-0 flex-col gap-3">
              <Segmented
                label="Batch status"
                value={status}
                onChange={setStatus}
                options={[
                  { value: 'all', label: 'All', count: counts.all },
                  ...BATCH_STATUSES.map(value => ({ value, label: BATCH_STATUS_LABEL[value], count: counts[value], tone: batchTone(value) })),
                ]}
              />
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Source ID, reference or error" aria-label="Search batches" className="h-11 pl-9 sm:h-9" />
                </div>
                <Select value={sourceType} onValueChange={setSourceType}>
                  <SelectTrigger className="h-11 w-full sm:h-9 sm:w-48" aria-label="Source type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sources</SelectItem>
                    {SOURCE_TYPES.map(value => (
                      <SelectItem key={value} value={value}>{SOURCE_TYPE_LABEL[value]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {batchError ? (
              <div className="space-y-3">
                <Notice tone="bad">
                  <p className="font-medium">Batches are unavailable</p>
                  <p className="mt-0.5 text-muted-foreground">{batchError}</p>
                </Notice>
                <Track>
                  <Pill onClick={() => loadBatches({ status, sourceType, search })}>Retry</Pill>
                </Track>
              </div>
            ) : (
              <Panel className={batchLoading ? 'opacity-60 transition-opacity' : undefined} aria-busy={batchLoading}>
                {batches.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
                    <p>{batchLoading ? 'Loading…' : filtered ? 'No batches match' : 'No batches'}</p>
                    {filtered && !batchLoading && (
                      <Track>
                        <Pill size="sm" onClick={() => { setSearch(''); setStatus('all'); setSourceType('all') }}>Reset filters</Pill>
                      </Track>
                    )}
                  </div>
                ) : (
                  <ul className="divide-y">
                    {batches.map(batch => (
                      <li key={batch.id}>
                        <Link href={`${basePath}/platform/accounting/${batch.id}`} className="flex min-h-11 min-w-0 items-center gap-3 px-4 py-3 hover:bg-muted/40">
                          <div className="min-w-0 flex-1">
                            <TitleLine as="p" tone={batchTone(batch.status)} status={BATCH_STATUS_LABEL[batch.status] || batch.status} className="text-sm font-medium text-foreground">
                              {SOURCE_TYPE_LABEL[batch.sourceType] || batch.sourceType} <Code>{recordReference('SRC', batch.sourceId)}</Code>
                            </TitleLine>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {[BATCH_STATUS_LABEL[batch.status] || batch.status, batch.rooftop?.name, batch.attemptCount ? `${batch.attemptCount} attempt${batch.attemptCount === 1 ? '' : 's'}` : '', batch.lastErrorCode && batch.status === 'failed' ? batch.lastErrorCode : '', batch.externalReference, dateTime(batch.updatedAt, timeZone)].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                          <span className="shrink-0 font-mono text-[13px] tabular-nums">{money(batch.totalDebitCents)}</span>
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
              <Segmented
                label="Mapping source type"
                value={mappingType}
                onChange={setMappingType}
                options={[
                  { value: 'all' as const, label: 'All', count: mappings.filter(m => mappingRooftop === 'all' || m.rooftop?.id === mappingRooftop).length },
                  ...SOURCE_TYPES.map(value => ({ value, label: SOURCE_TYPE_LABEL[value], count: mappings.filter(m => m.sourceType === value && (mappingRooftop === 'all' || m.rooftop?.id === mappingRooftop)).length })),
                ]}
              />
              {rooftops.length > 1 && (
                <Select value={mappingRooftop} onValueChange={setMappingRooftop}>
                  <SelectTrigger className="h-11 w-full sm:h-9 sm:w-56" aria-label="Rooftop">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All rooftops</SelectItem>
                    {rooftops.map(rooftop => (
                      <SelectItem key={rooftop.id} value={rooftop.id}>{rooftop.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {missingCodes.length > 0 && !mappingError && (
              <Notice tone="warn">
                <p className="font-medium">Unmapped codes: {missingCodes.length}</p>
                <p className="mt-0.5 break-words text-muted-foreground">{missingCodes.join(', ')}</p>
              </Notice>
            )}

            {mappingError ? (
              <div className="space-y-3">
                <Notice tone="bad">
                  <p className="font-medium">Mappings are unavailable</p>
                  <p className="mt-0.5 text-muted-foreground">{mappingError}</p>
                </Notice>
                <Track>
                  <Pill onClick={loadMappings}>Retry</Pill>
                </Track>
              </div>
            ) : (
              <Panel>
                {filteredMappings.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">No mappings</p>
                ) : (
                  <ul className="divide-y">
                    {filteredMappings.map(mapping => (
                      <li key={mapping.id} className="flex min-w-0 flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">
                            {SOURCE_TYPE_LABEL[mapping.sourceType] || mapping.sourceType} <Code>{mapping.sourceCode}</Code>
                          </p>
                          <p className="mt-0.5 break-words text-xs text-muted-foreground">
                            Dr {mapping.debitAccount} · Cr {mapping.creditAccount}
                            {rooftops.length > 1 && mapping.rooftop ? ` · ${mapping.rooftop.name}` : ''}
                          </p>
                        </div>
                        <Track className="self-start sm:self-auto">
                          <Pill size="sm" className="h-11 sm:h-7" onClick={() => openMappingEdit(mapping)}>
                            <Pencil />
                            Edit
                          </Pill>
                          <Pill size="sm" className="h-11 sm:h-7" onClick={() => { setDeleting(mapping); setDeleteError(null) }}>
                            <Trash2 />
                            Delete
                          </Pill>
                        </Track>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            )}
          </div>
        )}

        <CommandDialog
          open={stageOpen}
          title="Stage accounting batch"
          fields={stageFields}
          values={stageValues}
          fieldErrors={stageFieldErrors}
          error={stageError}
          busy={stageBusy}
          submitLabel="Stage"
          onValuesChange={changeStage}
          onSubmit={submitStage}
          onOpenChange={setStageOpen}
        />

        <CommandDialog
          open={Boolean(mappingForm)}
          title={mappingForm?.mode === 'edit' ? 'Edit mapping' : 'Add mapping'}
          fields={mappingFields}
          values={mappingForm?.values || {}}
          fieldErrors={mappingFieldErrors}
          error={mappingSubmitError}
          busy={mappingBusy}
          submitLabel={mappingForm?.mode === 'edit' ? 'Save' : 'Add'}
          onValuesChange={changeMapping}
          onSubmit={submitMapping}
          onOpenChange={open => { if (!open) setMappingForm(null) }}
        />

        <CommandDialog
          open={Boolean(deleting)}
          title="Delete mapping"
          description={deleting ? `${deleting.sourceType}/${deleting.sourceCode}: Dr ${deleting.debitAccount} · Cr ${deleting.creditAccount}` : undefined}
          fields={[]}
          values={{}}
          error={deleteError}
          busy={deleteBusy}
          danger
          submitLabel="Delete"
          onValuesChange={() => {}}
          onSubmit={confirmDelete}
          onOpenChange={open => { if (!open) setDeleting(null) }}
        />
      </div>
    </PageContainer>
  )
}
