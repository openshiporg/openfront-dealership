'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

export type AccountingMapping = { id: string; rooftop: { id: string; name: string }; sourceType: string; sourceCode: string; debitAccount: string; creditAccount: string; providerKey: string }
export type AccountingBatch = { id: string; rooftop: { id: string; name: string }; sourceType: string; sourceId: string; status: string; totalDebitCents: number; totalCreditCents: number; attemptCount: number; externalReference?: string; lastErrorCode?: string; updatedAt: string }
export type AccountingPayment = { id: string; rooftop: { id: string; name: string }; sourceType: string; amountCents: number; status: string; capturedCents: number; refundedCents: number; providerKey: string; checkoutUrl?: string; reconciliationReference?: string; serviceOrder?: { id: string; invoiceNumber?: string }; deal?: { id: string }; updatedAt: string }
export type AccountingRefund = { id: string; transaction: { id: string }; amountCents: number; reason: string; status: string; providerRefundId?: string; updatedAt: string }
export type AccountingWorkspace = { mappings: AccountingMapping[]; batches: AccountingBatch[]; payments: AccountingPayment[]; refunds: AccountingRefund[] }

export type InstalledPaymentProvider = { code: string; name: string }

const ACCOUNTING_PATH = '/dashboard/platform/accounting'

export async function getAccountingWorkspace() {
  return keystoneClient<{ accountingWorkspace: AccountingWorkspace }>(`
    query AccountingWorkspace {
      accountingWorkspace(limit: 100) {
        mappings { id rooftop { id name } sourceType sourceCode debitAccount creditAccount providerKey }
        batches { id rooftop { id name } sourceType sourceId status totalDebitCents totalCreditCents attemptCount externalReference lastErrorCode updatedAt }
        payments { id rooftop { id name } sourceType amountCents status capturedCents refundedCents providerKey checkoutUrl reconciliationReference serviceOrder { id invoiceNumber } deal { id } updatedAt }
        refunds { id transaction { id } amountCents reason status providerRefundId updatedAt }
      }
    }
  `, {}, { cache: 'no-store' })
}

export async function manageAccountingBatch(data: {
  batchId: string
  action: 'queue-post' | 'reconcile' | 'lock'
  reconciliationReference?: string
  idempotencyKey: string
}) {
  const response = await keystoneClient(`
    mutation ManageAccountingBatch($data: ManageAccountingBatchInput!) {
      manageAccountingBatch(data: $data) { id status }
    }
  `, { data })
  if (response.success) revalidatePath(ACCOUNTING_PATH)
  return response
}

export async function createPaymentCheckout(data: {
  sourceType: string
  sourceId: string
  amountCents: number
  providerKey: string
  idempotencyKey: string
}) {
  const response = await keystoneClient(`
    mutation CreatePaymentCheckout($data: CreatePaymentCheckoutInput!) {
      createPaymentCheckout(data: $data) { id checkoutUrl status }
    }
  `, { data })
  if (response.success) revalidatePath(ACCOUNTING_PATH)
  return response
}

export async function requestPaymentRefund(data: {
  transactionId: string
  amountCents: number
  reason: string
  idempotencyKey: string
}) {
  const response = await keystoneClient(`
    mutation RequestPaymentRefund($data: RequestPaymentRefundInput!) {
      requestPaymentRefund(data: $data) { id status }
    }
  `, { data })
  if (response.success) revalidatePath(ACCOUNTING_PATH)
  return response
}

export async function configureAccountingMapping(data: {
  rooftopId: string
  sourceType: string
  sourceCode: string
  debitAccount: string
  creditAccount: string
  providerKey: string
  idempotencyKey: string
}) {
  const response = await keystoneClient(`
    mutation ConfigureAccountingMapping($data: ConfigureAccountingMappingInput!) {
      configureAccountingMapping(data: $data) { id }
    }
  `, { data })
  if (response.success) revalidatePath(ACCOUNTING_PATH)
  return response
}

export async function stageAccountingBatch(data: {
  sourceType: string
  sourceId: string
  providerKey: string
  idempotencyKey: string
}) {
  const response = await keystoneClient(`
    mutation StageAccountingBatch($data: StageAccountingBatchInput!) {
      stageAccountingBatch(data: $data) { id status }
    }
  `, { data })
  if (response.success) revalidatePath(ACCOUNTING_PATH)
  return response
}

export async function getInstalledPaymentProviders() {
  return keystoneClient<{ paymentProviders: InstalledPaymentProvider[] }>(`
    query InstalledPaymentProviders {
      paymentProviders(where: { isInstalled: { equals: true } }) { code name }
    }
  `, {}, { cache: 'no-store' })
}
