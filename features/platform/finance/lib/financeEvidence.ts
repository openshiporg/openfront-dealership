import { z } from 'zod'
import { readFinanceEvidence, type FinanceEvidence } from '@/features/platform/deals/lib/financeEvidence'
import type { FinanceStep, FinanceStepCode } from '@/features/keystone/lifecycle/financePrerequisites'

export type { FinanceStep, FinanceStepCode }
export type CashPaymentState = { amountDueCents: number; receivedCents: number; remainingCents: number }

/** The server's finance projection plus the step plan the finance and delivery desks act on. */
export type DeskFinanceEvidence = FinanceEvidence & {
  structureType: 'cash' | 'finance'
  steps: FinanceStep[]
  nextStep: FinanceStepCode | null
  payment: CashPaymentState | null
}

const bounded = z.string().max(1000)
const step = z.object({
  code: bounded.min(1),
  label: bounded.min(1),
  state: z.enum(['done', 'todo', 'optional']),
  available: z.boolean(),
  blockedReason: bounded.nullable(),
  detail: bounded.nullable(),
})
const cents = z.number().int()
const extras = z.object({
  structureType: z.enum(['cash', 'finance']),
  steps: z.array(step).max(40),
  nextStep: bounded.nullable(),
  payment: z.object({ amountDueCents: cents, receivedCents: cents, remainingCents: cents }).nullable(),
})

// Base fields go through the shared parser; a missing or malformed plan is "no plan", never "done".
export function readDeskFinanceEvidence(value: unknown): DeskFinanceEvidence | null {
  const base = readFinanceEvidence(value)
  if (!base) return null
  const parsed = extras.safeParse(value)
  if (!parsed.success) return { ...base, structureType: 'finance', steps: [], nextStep: null, payment: null }
  return {
    ...base,
    structureType: parsed.data.structureType,
    steps: parsed.data.steps as FinanceStep[],
    nextStep: parsed.data.nextStep as FinanceStepCode | null,
    payment: parsed.data.payment,
  }
}

/** "899", "1,299.50", "$1,299" -> cents. Throws a staff-facing message otherwise. */
export function parseDollarsToCents(raw: string, label: string) {
  const value = raw.trim().replace(/^\$/, '').replace(/,/g, '')
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error(`${label} must be a dollar amount, for example 1,299.50.`)
  const [whole, fraction = ''] = value.split('.')
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(result) || result > 2_147_483_647) throw new Error(`${label} is outside the supported range.`)
  return result
}

/** Cents -> "1,299.50" for prefilled dollar inputs. */
export function centsToDollarInput(value: number) {
  return (value / 100).toLocaleString('en-US', { minimumFractionDigits: value % 100 ? 2 : 0, maximumFractionDigits: 2 })
}
