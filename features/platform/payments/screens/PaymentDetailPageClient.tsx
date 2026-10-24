'use client'

import Link from 'next/link'
import { useCallback, useState } from 'react'
import { ArrowLeft, ExternalLink, RefreshCw, Scale, Undo2 } from 'lucide-react'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import { Code, DeskHeader, DeskSection, Facts, Notice, Panel, Pill, Readout, ReadoutStrip, TitleLine, Track } from '@/features/platform/components/desk'
import { recordReference } from '@/features/platform/lib/format'
import { formatCentsForInput, parseDollarsToCents } from '@/features/platform/deals/lib/moneyInput'
import { CommandDialog, type FieldErrors } from '@/features/platform/accounting/components/CommandDialog'
import { PAYMENT_STATUS_LABEL, dateTime, money, nonce, paymentTone, refundTone } from '@/features/platform/accounting/lib/format'

import { getPayment, reconcilePaymentTransaction, requestPaymentRefund } from '../actions'
import { REFUNDABLE_STATUSES, SETTLED_STATUSES, paymentSource } from '../lib/format'
import type { PaymentDetail, PaymentProviderEventRecord, PaymentRefundRecord } from '../lib/types'

const REFUND_LABEL: Record<string, string> = { creating: 'Creating', pending: 'Pending', succeeded: 'Succeeded', failed: 'Failed', canceled: 'Canceled' }

export function PaymentDetailPageClient({
  id,
  timeZone,
  initialPayment,
  initialRefunds,
  initialEvents,
  initialError,
}: {
  id: string
  timeZone: string
  initialPayment: PaymentDetail | null
  initialRefunds: PaymentRefundRecord[]
  initialEvents: PaymentProviderEventRecord[]
  initialError: string | null
}) {
  const [payment, setPayment] = useState(initialPayment)
  const [refunds, setRefunds] = useState(initialRefunds)
  const [events, setEvents] = useState(initialEvents)
  const [error, setError] = useState(initialError)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [dialog, setDialog] = useState<'reconcile' | 'refund' | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const result = await getPayment(id)
    if (result.success) {
      setPayment(result.data.paymentTransaction)
      setRefunds(result.data.paymentRefunds || [])
      setEvents(result.data.paymentProviderEvents || [])
      setError(null)
    } else {
      setError(result.error)
    }
    setLoading(false)
  }, [id])

  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'page' as const, label: 'Platform' },
    { type: 'link' as const, label: 'Payments', href: `${basePath}/platform/payments` },
    { type: 'page' as const, label: recordReference('PAY', id) || 'Payment' },
  ]

  if (!payment) {
    return (
      <PageContainer
        title="Payment"
        breadcrumbs={breadcrumbs}
        header={
          <DeskHeader
            title="Payment"
            tone="bad"
            status="Unavailable"
            actions={
              <Track>
                <Pill asChild className="h-11 sm:h-8">
                  <Link href={`${basePath}/platform/payments`}>
                    <ArrowLeft />
                    Payments
                  </Link>
                </Pill>
              </Track>
            }
          />
        }
      >
        <div className="min-w-0 max-w-full space-y-3 px-4 pb-24 md:px-6">
          <Notice tone="bad">
            <p className="font-medium">{error ? 'Payment is unavailable' : 'Payment not found'}</p>
            {error && <p className="mt-0.5 text-muted-foreground">{error}</p>}
          </Notice>
          <Track>
            <Pill onClick={load} disabled={loading}>Retry</Pill>
          </Track>
        </div>
      </PageContainer>
    )
  }

  const reservedRefunds = refunds.filter(r => ['creating', 'pending', 'succeeded'].includes(r.status)).reduce((total, r) => total + r.amountCents, 0)
  const refundable = Math.max(0, payment.capturedCents - reservedRefunds)
  const settled = SETTLED_STATUSES.includes(payment.status)
  const reconciled = Boolean(payment.reconciledAt)
  const reconcileWhy = reconciled ? 'Already reconciled' : !settled ? 'Needs a captured or refunded payment' : null
  const refundWhy = !REFUNDABLE_STATUSES.includes(payment.status)
    ? 'Needs a captured payment'
    : !payment.providerTransactionId
      ? 'No provider transaction ID yet'
      : refundable <= 0
        ? 'Nothing left to refund'
        : null
  const source = paymentSource(payment)
  const statusLabel = PAYMENT_STATUS_LABEL[payment.status] || payment.status

  const open = (kind: 'reconcile' | 'refund') => {
    setDialog(kind)
    setValues(kind === 'refund' ? { amount: formatCentsForInput(refundable), reason: '' } : { reference: '' })
    setFieldErrors({})
    setSubmitError(null)
  }

  const submit = async () => {
    const errors: FieldErrors = {}
    if (dialog === 'reconcile') {
      const reference = (values.reference || '').trim()
      if (!reference) errors.reference = 'Reconciliation reference is required'
      else if (reference.length > 200) errors.reference = 'Up to 200 characters'
      setFieldErrors(errors)
      if (Object.keys(errors).length) return
      setBusy(true)
      setSubmitError(null)
      const result = await reconcilePaymentTransaction({ transactionId: payment.id, reconciliationReference: reference, idempotencyKey: nonce('payment-reconcile') })
      setBusy(false)
      if (!result.success) return setSubmitError(result.error)
      setMessage('Payment reconciled.')
    } else if (dialog === 'refund') {
      const cents = parseDollarsToCents(values.amount || '')
      const reason = (values.reason || '').trim()
      if (cents === null) errors.amount = 'Enter dollars and cents'
      else if (cents <= 0) errors.amount = 'Amount must be more than $0'
      else if (cents > refundable) errors.amount = `Up to ${money(refundable, payment.currency)}`
      if (!reason) errors.reason = 'Reason is required'
      else if (reason.length > 500) errors.reason = 'Up to 500 characters'
      setFieldErrors(errors)
      if (Object.keys(errors).length || !cents) return
      setBusy(true)
      setSubmitError(null)
      const result = await requestPaymentRefund({ transactionId: payment.id, amountCents: cents, reason, idempotencyKey: nonce('payment-refund') })
      setBusy(false)
      if (!result.success) return setSubmitError(result.error)
      setMessage(`Refund ${REFUND_LABEL[result.data.requestPaymentRefund.status]?.toLowerCase() || result.data.requestPaymentRefund.status}.`)
    }
    setDialog(null)
    await load()
  }

  const header = (
    <DeskHeader
      eyebrow={recordReference('PAY', payment.id)}
      title={`${money(payment.amountCents, payment.currency)} · ${source.label}`}
      tone={paymentTone(payment.status)}
      status={statusLabel}
      meta={[statusLabel, payment.paymentProvider?.name || payment.providerKey, payment.rooftop?.name, reconciled ? 'Reconciled' : settled ? 'Unreconciled' : ''].filter(Boolean).join(' · ')}
      actions={
        <Track>
          <Pill asChild className="h-11 sm:h-8">
            <Link href={`${basePath}/platform/payments`}>
              <ArrowLeft />
              Payments
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
    <PageContainer title="Payment" header={header} breadcrumbs={breadcrumbs}>
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
        {payment.status === 'failed' && payment.failureCode && <Notice tone="bad">Failure: {payment.failureCode}</Notice>}

        <ReadoutStrip>
          <Readout label="Amount" value={money(payment.amountCents, payment.currency)} />
          <Readout label="Captured" value={money(payment.capturedCents, payment.currency)} tone={payment.capturedCents ? 'ok' : 'idle'} />
          <Readout label="Refunded" value={money(payment.refundedCents, payment.currency)} tone={payment.refundedCents ? 'info' : 'idle'} />
          <Readout label="Refundable" value={money(refundable, payment.currency)} />
        </ReadoutStrip>

        <DeskSection title="Actions">
          <Panel>
            <ul className="divide-y">
              <li className="flex min-w-0 flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Reconcile</p>
                  <p id="why-reconcile" className="text-xs text-muted-foreground">
                    {reconciled ? `${payment.reconciliationReference} · ${dateTime(payment.reconciledAt, timeZone)}` : reconcileWhy || ''}
                  </p>
                </div>
                <Track>
                  <Pill variant={reconcileWhy ? 'raised' : 'primary'} disabled={Boolean(reconcileWhy)} aria-describedby="why-reconcile" onClick={() => open('reconcile')} className="h-11 sm:h-8">
                    <Scale />
                    Reconcile
                  </Pill>
                </Track>
              </li>
              <li className="flex min-w-0 flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Refund</p>
                  {refundWhy && <p id="why-refund" className="text-xs text-muted-foreground">{refundWhy}</p>}
                </div>
                <Track>
                  <Pill disabled={Boolean(refundWhy)} aria-describedby={refundWhy ? 'why-refund' : undefined} onClick={() => open('refund')} className="h-11 sm:h-8">
                    <Undo2 />
                    Refund
                  </Pill>
                </Track>
              </li>
              {payment.checkoutUrl && ['creating', 'pending'].includes(payment.status) && (
                <li className="flex min-w-0 flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <p className="text-sm font-medium text-foreground">Checkout link</p>
                  <Track>
                    <Pill asChild className="h-11 sm:h-8">
                      <a href={payment.checkoutUrl} target="_blank" rel="noreferrer noopener">
                        <ExternalLink />
                        Open checkout
                      </a>
                    </Pill>
                  </Track>
                </li>
              )}
            </ul>
          </Panel>
        </DeskSection>

        <div className="grid min-w-0 gap-8 lg:grid-cols-2">
          <DeskSection title="Source">
            <Panel className="px-4 py-1">
              <Facts
                items={[
                  { label: 'Type', value: payment.sourceType === 'deal' ? 'Deal' : payment.sourceType === 'service' ? 'Service order' : payment.sourceType },
                  { label: 'Record', value: source.href ? <Link href={`${basePath}${source.href}`} className="underline underline-offset-2">{source.label}</Link> : source.label },
                  source.detail ? { label: 'Customer', value: source.detail } : null,
                  payment.rooftop ? { label: 'Rooftop', value: payment.rooftop.name } : null,
                ]}
              />
            </Panel>
          </DeskSection>
          <DeskSection title="Provider">
            <Panel className="px-4 py-1">
              <Facts
                items={[
                  { label: 'Provider', value: payment.paymentProvider?.name || payment.providerKey },
                  payment.providerTransactionId ? { label: 'Transaction ID', value: payment.providerTransactionId, mono: true } : null,
                  payment.providerSessionId ? { label: 'Session ID', value: payment.providerSessionId, mono: true } : null,
                  { label: 'Created', value: dateTime(payment.createdAt, timeZone) },
                  { label: 'Updated', value: dateTime(payment.updatedAt, timeZone) },
                  { label: 'Version', value: payment.version, mono: true },
                ]}
              />
            </Panel>
          </DeskSection>
        </div>

        <DeskSection title="Refunds" count={refunds.length}>
          <Panel>
            {refunds.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No refunds</p>
            ) : (
              <ul className="divide-y">
                {refunds.map(refund => (
                  <li key={refund.id} className="flex min-w-0 items-start gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <TitleLine as="p" tone={refundTone(refund.status)} status={REFUND_LABEL[refund.status] || refund.status} className="text-sm font-medium text-foreground">
                        {REFUND_LABEL[refund.status] || refund.status}
                        {refund.providerRefundId ? <> <Code>{refund.providerRefundId}</Code></> : null}
                      </TitleLine>
                      <p className="mt-0.5 break-words text-xs text-muted-foreground">
                        {[refund.reason, refund.failureCode, dateTime(refund.createdAt, timeZone)].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-[13px] tabular-nums">{money(refund.amountCents, payment.currency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </DeskSection>

        <DeskSection title="Provider events" count={events.length}>
          <Panel>
            {events.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No provider events</p>
            ) : (
              <ul className="divide-y">
                {events.map(event => (
                  <li key={event.id} className="min-w-0 px-4 py-3">
                    <p className="text-sm font-medium text-foreground">
                      <Code className="text-foreground">{event.eventType}</Code>
                    </p>
                    <p className="mt-0.5 break-words text-xs text-muted-foreground">
                      {[`Received ${dateTime(event.receivedAt, timeZone)}`, `Signed ${dateTime(event.signatureTimestamp, timeZone)}`, event.refund ? 'Refund event' : ''].filter(Boolean).join(' · ')}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground" title={event.providerEventId}>{event.providerEventId}</p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground" title={event.payloadDigest}>{event.payloadDigest}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </DeskSection>

        <CommandDialog
          open={dialog === 'reconcile'}
          title="Reconcile payment"
          fields={[{ name: 'reference', label: 'Reconciliation reference', maxLength: 200, wide: true, placeholder: 'Deposit or statement reference' }]}
          values={values}
          fieldErrors={fieldErrors}
          error={submitError}
          busy={busy}
          submitLabel="Reconcile"
          onValuesChange={next => { setValues(next); setFieldErrors({}) }}
          onSubmit={submit}
          onOpenChange={value => { if (!value) setDialog(null) }}
        />

        <CommandDialog
          open={dialog === 'refund'}
          title="Refund payment"
          description={`Refundable: ${money(refundable, payment.currency)}`}
          fields={[
            { name: 'amount', label: 'Amount', type: 'money', wide: true },
            { name: 'reason', label: 'Reason', type: 'textarea', maxLength: 500 },
          ]}
          values={values}
          fieldErrors={fieldErrors}
          error={submitError}
          busy={busy}
          danger
          submitLabel="Refund"
          onValuesChange={next => { setValues(next); setFieldErrors({}) }}
          onSubmit={submit}
          onOpenChange={value => { if (!value) setDialog(null) }}
        />
      </div>
    </PageContainer>
  )
}
