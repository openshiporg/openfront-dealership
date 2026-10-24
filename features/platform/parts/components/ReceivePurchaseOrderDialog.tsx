'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Notice, Pill, Track } from '@/features/platform/components/desk'

import { managePurchaseOrder } from '../actions'
import { poLines, type PurchaseOrder } from '../lib/types'
import { FormField, hasErrors, parseWhole, type FieldErrors } from './FormField'

/** Receive some or all outstanding quantities. Posts stock receipts in the same command. */
export function ReceivePurchaseOrderDialog({
  open,
  order,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  order: PurchaseOrder
  onOpenChange: (open: boolean) => void
  onSaved: (status: string) => void
}) {
  const lines = poLines(order).filter(line => line.quantity > line.receivedQuantity)
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [idempotencyKey, setIdempotencyKey] = useState('')

  useEffect(() => {
    if (!open) return
    setQuantities(Object.fromEntries(poLines(order).map(line => [line.partId, String(Math.max(0, line.quantity - line.receivedQuantity))])))
    setErrors({})
    setFormError(null)
    setIdempotencyKey(`parts-desk:po-receive:${crypto.randomUUID()}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const next: FieldErrors = {}
    const receiptLines: Array<{ partId: string; quantity: number }> = []
    for (const line of lines) {
      const outstanding = line.quantity - line.receivedQuantity
      const value = parseWhole(quantities[line.partId] || '0', 0)
      if (value === null) next[line.partId] = 'Whole number of 0 or more'
      else if (value > outstanding) next[line.partId] = `At most ${outstanding}`
      else receiptLines.push({ partId: line.partId, quantity: value })
    }
    if (!hasErrors(next) && !receiptLines.some(line => line.quantity > 0)) next.form = 'Enter a received quantity for at least one line'
    setErrors(next)
    if (hasErrors(next)) return

    setBusy(true)
    setFormError(null)
    const response = await managePurchaseOrder({
      action: 'receive',
      purchaseOrderId: order.id,
      expectedUpdatedAt: order.updatedAt,
      receiptLines,
      idempotencyKey,
    })
    setBusy(false)
    if (!response.success) {
      setFormError(response.error)
      if (response.rejected) setIdempotencyKey(`parts-desk:po-receive:${crypto.randomUUID()}`)
      return
    }
    onSaved(response.data.managePartsPurchaseOrder.status)
  }

  return (
    <Dialog open={open} onOpenChange={value => { if (!busy) onOpenChange(value) }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Receive {order.reference}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="divide-y rounded-xl border">
            {lines.map(line => (
              <div key={line.partId} className="grid min-w-0 grid-cols-[minmax(0,1fr)_6rem] items-start gap-3 px-3 py-3">
                <div className="min-w-0 text-sm">
                  <p className="font-mono font-medium">{line.partNumber}</p>
                  <p className="break-words text-xs text-muted-foreground">{line.description}</p>
                  <p className="font-mono text-[11px] tabular-nums text-muted-foreground">{line.receivedQuantity}/{line.quantity} received</p>
                </div>
                <FormField id={`receive-${line.partId}`} label="Receive" error={errors[line.partId]}>
                  <Input
                    id={`receive-${line.partId}`}
                    className="h-11 sm:h-9"
                    inputMode="numeric"
                    value={quantities[line.partId] || ''}
                    aria-invalid={Boolean(errors[line.partId])}
                    onChange={event => {
                      setQuantities(current => ({ ...current, [line.partId]: event.target.value }))
                      setErrors(current => ({ ...current, [line.partId]: undefined, form: undefined }))
                    }}
                  />
                </FormField>
              </div>
            ))}
          </div>
          {errors.form && <Notice tone="bad">{errors.form}</Notice>}
          {formError && <Notice tone="bad">{formError}</Notice>}
          <DialogFooter className="sm:justify-end">
            <Track>
              <Pill variant="plain" className="h-11 sm:h-8" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Pill>
              <Pill type="submit" variant="primary" className="h-11 sm:h-8" disabled={busy || !lines.length}>{busy ? 'Receiving…' : 'Receive'}</Pill>
            </Track>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
