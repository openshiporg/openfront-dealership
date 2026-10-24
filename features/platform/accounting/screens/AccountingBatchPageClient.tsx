'use client'

import Link from 'next/link'
import { useCallback, useState } from 'react'
import { ArrowLeft, CheckCircle2, FileLock2, RefreshCw, Send, XCircle, Scale } from 'lucide-react'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import { Code, DeskHeader, DeskSection, Facts, Notice, Panel, Pill, Readout, ReadoutStrip, TitleLine, Track } from '@/features/platform/components/desk'
import { recordReference } from '@/features/platform/lib/format'

import { getAccountingBatch, manageAccountingBatch } from '../actions'
import { CommandDialog, type CommandField, type FieldErrors } from '../components/CommandDialog'
import { BATCH_STATUS_LABEL, SOURCE_TYPE_LABEL, batchTone, dateTime, money, nonce } from '../lib/format'
import type { AccountingBatchDetail, AccountingProviderResponseRecord, BatchSourceSummary } from '../lib/types'

type BatchAction = 'queue-post' | 'record-posted' | 'record-failed' | 'reconcile' | 'lock'

const ACTIONS: Array<{
  action: BatchAction
  label: string
  icon: typeof Send
  from: string[]
  requires: string
  field?: CommandField
  primary?: boolean
}> = [
  { action: 'queue-post', label: 'Queue for posting', icon: Send, from: ['staged', 'failed'], requires: 'Needs a staged or failed batch', primary: true },
  { action: 'record-posted', label: 'Record posted', icon: CheckCircle2, from: ['posting'], requires: 'Needs a batch in posting', field: { name: 'externalReference', label: 'GL journal reference', maxLength: 200, wide: true }, primary: true },
  { action: 'record-failed', label: 'Record failed', icon: XCircle, from: ['posting'], requires: 'Needs a batch in posting', field: { name: 'errorCode', label: 'Error code', maxLength: 100, wide: true } },
  { action: 'reconcile', label: 'Reconcile', icon: Scale, from: ['posted'], requires: 'Needs a posted batch', field: { name: 'reconciliationReference', label: 'Reconciliation reference', maxLength: 200, wide: true }, primary: true },
  { action: 'lock', label: 'Lock', icon: FileLock2, from: ['reconciled'], requires: 'Needs a reconciled batch', primary: true },
]

const FIELD_LIMITS: Record<string, { label: string; max: number }> = {
  externalReference: { label: 'GL journal reference', max: 200 },
  errorCode: { label: 'Error code', max: 100 },
  reconciliationReference: { label: 'Reconciliation reference', max: 200 },
}

export function AccountingBatchPageClient({
  id,
  timeZone,
  initialBatch,
  initialResponses,
  initialSource,
  initialError,
}: {
  id: string
  timeZone: string
  initialBatch: AccountingBatchDetail | null
  initialResponses: AccountingProviderResponseRecord[]
  initialSource: BatchSourceSummary | null
  initialError: string | null
}) {
  const [batch, setBatch] = useState(initialBatch)
  const [responses, setResponses] = useState(initialResponses)
  const [source, setSource] = useState(initialSource)
  const [error, setError] = useState(initialError)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState<(typeof ACTIONS)[number] | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const result = await getAccountingBatch(id)
    if (result.success) {
      setBatch(result.data.batch)
      setResponses(result.data.responses)
      setSource(result.data.source)
      setError(null)
    } else {
      setError(result.error)
    }
    setLoading(false)
  }, [id])

  const openAction = (item: (typeof ACTIONS)[number]) => {
    setPending(item)
    setValues({})
    setFieldErrors({})
    setSubmitError(null)
  }

  const submit = async () => {
    if (!pending || !batch) return
    const errors: FieldErrors = {}
    const field = pending.field?.name
    const value = field ? (values[field] || '').trim() : ''
    if (field) {
      const limit = FIELD_LIMITS[field]
      if (!value) errors[field] = `${limit.label} is required`
      else if (value.length > limit.max) errors[field] = `Up to ${limit.max} characters`
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length) return
    setBusy(true)
    setSubmitError(null)
    const result = await manageAccountingBatch({
      batchId: batch.id,
      action: pending.action,
      ...(field ? { [field]: value } : {}),
      idempotencyKey: nonce(`accounting-${pending.action}`),
    })
    setBusy(false)
    if (!result.success) {
      setSubmitError(result.error)
      return
    }
    setPending(null)
    setMessage(`${pending.label}: ${BATCH_STATUS_LABEL[result.data.manageAccountingBatch.status] || result.data.manageAccountingBatch.status}`)
    await load()
  }

  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'page' as const, label: 'Platform' },
    { type: 'link' as const, label: 'Accounting', href: `${basePath}/platform/accounting` },
    { type: 'page' as const, label: recordReference('BAT', id) || 'Batch' },
  ]

  const back = (
    <Track>
      <Pill asChild className="h-11 sm:h-8">
        <Link href={`${basePath}/platform/accounting`}>
          <ArrowLeft />
          Accounting
        </Link>
      </Pill>
    </Track>
  )

  if (!batch) {
    return (
      <PageContainer title="Accounting batch" header={<DeskHeader title="Accounting batch" tone="bad" status="Unavailable" actions={back} />} breadcrumbs={breadcrumbs}>
        <div className="min-w-0 max-w-full space-y-3 px-4 pb-24 md:px-6">
          <Notice tone="bad">
            <p className="font-medium">{error ? 'Batch is unavailable' : 'Batch not found'}</p>
            {error && <p className="mt-0.5 text-muted-foreground">{error}</p>}
          </Notice>
          <Track>
            <Pill onClick={load} disabled={loading}>Retry</Pill>
          </Track>
        </div>
      </PageContainer>
    )
  }

  const lines = Array.isArray(batch.lines) ? batch.lines : []
  const balanced = batch.totalDebitCents === batch.totalCreditCents
  const statusLabel = BATCH_STATUS_LABEL[batch.status] || batch.status

  const header = (
    <DeskHeader
      eyebrow={recordReference('BAT', batch.id)}
      title={`${SOURCE_TYPE_LABEL[batch.sourceType] || batch.sourceType} batch`}
      tone={batchTone(batch.status)}
      status={statusLabel}
      meta={[statusLabel, batch.rooftop?.name, batch.providerKey].filter(Boolean).join(' · ')}
      actions={
        <Track>
          <Pill asChild className="h-11 sm:h-8">
            <Link href={`${basePath}/platform/accounting`}>
              <ArrowLeft />
              Accounting
            </Link>
          </Pill>
          <Pill onClick={load} disabled={loading} aria-label="Refresh" className="h-11 sm:h-8">
            <RefreshCw className={loading ? 'animate-spin' : undefined} />
            Refresh
          </Pill>
        </Track>
      }
    />
  )

  return (
    <PageContainer title="Accounting batch" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 max-w-full space-y-8 px-4 pb-24 md:px-6">
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
        {error && <Notice tone="bad">{error}</Notice>}
        {batch.status === 'failed' && batch.lastErrorCode && <Notice tone="bad">Last error: {batch.lastErrorCode}</Notice>}

        <ReadoutStrip>
          <Readout label="Debits" value={money(batch.totalDebitCents)} />
          <Readout label="Credits" value={money(batch.totalCreditCents)} tone={balanced ? 'ok' : 'bad'} sub={balanced ? 'Balanced' : 'Out of balance'} />
          <Readout label="Attempts" value={batch.attemptCount} />
          <Readout label="Lines" value={lines.length} />
        </ReadoutStrip>

        <DeskSection title="Actions">
          <Panel>
            <ul className="divide-y">
              {ACTIONS.map(item => {
                const allowed = item.from.includes(batch.status)
                const Icon = item.icon
                return (
                  <li key={item.action} className="flex min-w-0 flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      {!allowed && <p id={`why-${item.action}`} className="text-xs text-muted-foreground">{item.requires}</p>}
                    </div>
                    <Track>
                      <Pill
                        variant={allowed && item.primary ? 'primary' : 'raised'}
                        disabled={!allowed}
                        aria-describedby={allowed ? undefined : `why-${item.action}`}
                        onClick={() => openAction(item)}
                        className="h-11 sm:h-8"
                      >
                        <Icon />
                        {item.label}
                      </Pill>
                    </Track>
                  </li>
                )
              })}
            </ul>
          </Panel>
        </DeskSection>

        <div className="grid min-w-0 gap-8 lg:grid-cols-2">
          <DeskSection title="Source">
            <Panel className="px-4 py-1">
              <Facts
                items={[
                  { label: 'Type', value: SOURCE_TYPE_LABEL[batch.sourceType] || batch.sourceType },
                  {
                    label: 'Record',
                    value: source ? (
                      source.href ? (
                        <Link href={`${basePath}${source.href}`} className="underline underline-offset-2">{source.label}</Link>
                      ) : (
                        source.label
                      )
                    ) : (
                      <Code>{batch.sourceId}</Code>
                    ),
                  },
                  source?.detail ? { label: 'Detail', value: source.detail } : null,
                  { label: 'Source ID', value: batch.sourceId, mono: true },
                ]}
              />
            </Panel>
          </DeskSection>

          <DeskSection title="History">
            <Panel className="px-4 py-1">
              <Facts
                items={[
                  { label: 'Staged', value: dateTime(batch.createdAt, timeZone) },
                  { label: 'Posted', value: batch.postedAt ? dateTime(batch.postedAt, timeZone) : 'Not posted' },
                  batch.externalReference ? { label: 'GL reference', value: batch.externalReference, mono: true } : null,
                  { label: 'Reconciled', value: batch.reconciledAt ? dateTime(batch.reconciledAt, timeZone) : 'Not reconciled' },
                  { label: 'Locked', value: batch.lockedAt ? dateTime(batch.lockedAt, timeZone) : 'Not locked' },
                  { label: 'Updated', value: dateTime(batch.updatedAt, timeZone) },
                ]}
              />
            </Panel>
          </DeskSection>
        </div>

        <DeskSection title="Journal lines" count={lines.length}>
          <Panel className="overflow-hidden">
            {lines.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No lines</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-0 text-sm">
                  <thead className="border-b text-left">
                    <tr>
                      <th className="px-4 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Account</th>
                      <th className="px-4 py-2 text-right font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Debit</th>
                      <th className="px-4 py-2 text-right font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {lines.map((line, index) => (
                      <tr key={`${line.sourceCode}-${line.direction}-${index}`}>
                        <td className="px-4 py-2.5">
                          <p className="break-words text-foreground">{line.account}</p>
                          <Code>{line.sourceCode}</Code>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-[13px] tabular-nums">{line.direction === 'debit' ? money(line.amountCents) : ''}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-[13px] tabular-nums">{line.direction === 'credit' ? money(line.amountCents) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t font-medium">
                    <tr>
                      <td className="px-4 py-2.5">Total</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-[13px] tabular-nums">{money(batch.totalDebitCents)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-[13px] tabular-nums">{money(batch.totalCreditCents)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Panel>
        </DeskSection>

        <DeskSection title="Provider responses" count={responses.length}>
          <Panel>
            {responses.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No responses recorded</p>
            ) : (
              <ul className="divide-y">
                {responses.map(response => {
                  const evidence = (response.immutableResponse || {}) as Record<string, unknown>
                  const failed = response.responseCode === 'failed'
                  return (
                    <li key={response.id} className="min-w-0 px-4 py-3">
                      <TitleLine as="p" tone={failed ? 'bad' : 'ok'} status={response.responseCode} className="text-sm font-medium text-foreground">
                        {failed ? 'Failed' : response.responseCode === 'posted' ? 'Posted' : response.responseCode}
                        {response.externalReference ? <> <Code>{response.externalReference}</Code></> : null}
                      </TitleLine>
                      <p className="mt-0.5 break-words text-xs text-muted-foreground">
                        {[
                          dateTime(response.receivedAt, timeZone),
                          evidence.lastErrorCode ? String(evidence.lastErrorCode) : '',
                          evidence.attemptCount != null ? `Attempt ${evidence.attemptCount}` : '',
                          response.providerKey,
                        ].filter(Boolean).join(' · ')}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground" title={response.requestFingerprint}>
                        {response.requestFingerprint}
                      </p>
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>
        </DeskSection>

        <CommandDialog
          open={Boolean(pending)}
          title={pending?.label || ''}
          description={pending?.action === 'lock' ? 'Locked batches cannot change.' : undefined}
          fields={pending?.field ? [pending.field] : []}
          values={values}
          fieldErrors={fieldErrors}
          error={submitError}
          busy={busy}
          danger={pending?.action === 'record-failed'}
          submitLabel={pending?.label || 'Save'}
          onValuesChange={next => { setValues(next); setFieldErrors({}) }}
          onSubmit={submit}
          onOpenChange={open => { if (!open) setPending(null) }}
        />
      </div>
    </PageContainer>
  )
}
