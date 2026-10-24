export type RooftopOption = { id: string; name: string }

export type AccountingBatchListItem = {
  id: string
  rooftop: RooftopOption | null
  sourceType: string
  sourceId: string
  status: string
  providerKey: string
  totalDebitCents: number
  totalCreditCents: number
  attemptCount: number
  externalReference: string | null
  lastErrorCode: string | null
  postedAt: string | null
  reconciledAt: string | null
  lockedAt: string | null
  createdAt: string
  updatedAt: string
}

export type AccountingLine = { account: string; direction: 'debit' | 'credit'; amountCents: number; sourceCode: string }

export type AccountingBatchDetail = AccountingBatchListItem & { lines: AccountingLine[] | null }

export type AccountingProviderResponseRecord = {
  id: string
  providerKey: string
  responseCode: string
  externalReference: string | null
  requestFingerprint: string
  immutableResponse: Record<string, unknown> | null
  receivedAt: string
}

export type BatchCounts = Record<'all' | 'staged' | 'posting' | 'failed' | 'posted' | 'reconciled' | 'locked', number>

export type BatchSourceSummary = { label: string; detail: string; href: string | null }

export type AccountingMappingRecord = {
  id: string
  rooftop: RooftopOption | null
  sourceType: string
  sourceCode: string
  debitAccount: string
  creditAccount: string
  providerKey: string
  updatedAt: string
}

export type StageSourceOption = { id: string; label: string; detail: string; rooftop: string }
