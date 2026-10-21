import { z } from 'zod'
import type { PrerequisiteReadiness } from '@/features/keystone/lifecycle/financePrerequisites'

export type FinanceEvidence = {
  worksheetVersion: number
  selectedOfferCurrent: boolean
  fundingCurrent: boolean
  fundingStatus: string | null
  fundingReference: string | null
  fundingUpdatedAt: string | null
  fundingWorksheetVersion: number | null
  prerequisites: PrerequisiteReadiness
  issue: string | null
}

const bounded = z.string().max(1000)
const nullableText = bounded.nullable()
const hash = z.string().regex(/^[a-f0-9]{64}$/)
const revision = z.object({ id: bounded.min(1), status: bounded.min(1), updatedAt: z.string().datetime(), revisionHash: hash, providerKey: bounded.optional() })
const schema = z.object({ worksheetVersion: z.number().int().positive(), selectedOfferCurrent: z.boolean(), fundingCurrent: z.boolean(),
  fundingStatus: nullableText, fundingReference: nullableText, fundingUpdatedAt: z.string().datetime().nullable(), fundingWorksheetVersion: z.number().int().positive().nullable(), issue: nullableText,
  prerequisites: z.object({ current: z.boolean(), digest: hash.nullable(), reviewEventKey: nullableText, issue: nullableText,
    snapshot: z.object({ version: z.literal(1), contract: revision, menu: revision.extend({ version: z.number().int().positive() }), compliance: z.array(revision.extend({ checkType: bounded })).max(4) }).nullable(),
    capability: z.object({ providerKey: z.literal('operator-recorded'), configurationVersion: z.literal(1), mode: z.literal('operator-recorded'), humanReviewRequired: z.literal(true), externalRequestSent: z.literal(false), documentSignatureVerified: z.literal(false), legalPolicyVerified: z.literal(false), fundingSettlementVerified: z.literal(false) }),
  }),
})

// A missing/legacy/malformed projection is unknown, never an approved/funded DTO.
export function readFinanceEvidence(value: unknown): FinanceEvidence | null {
  const parsed = schema.safeParse(value)
  return parsed.success ? parsed.data : null
}
