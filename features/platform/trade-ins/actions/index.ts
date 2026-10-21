'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

export type TradeIn = {
  id: string
  vin: string | null
  year: string | null
  make: string | null
  model: string | null
  trim: string | null
  mileage: number | null
  condition: string | null
  exteriorCondition: string | null
  interiorCondition: string | null
  mechanicalIssues: string | null
  referenceValue: number | null
  offerAmount: number | null
  appraisedBy: { id: string; name: string | null } | null
  lead: { id: string; firstName: string | null; lastName: string | null; email: string | null; phone: string | null } | null
  deal: { id: string; status: string | null; vehicle: { year: number | null; make: string | null; model: string | null } | null } | null
}

const TRADE_INS_PATH = '/dashboard/platform/trade-ins'

export async function getTradeIns() {
  return keystoneClient<{ tradeIns: TradeIn[] }>(`
    query TradeInDesk {
      tradeIns(take: 200) {
        id
        vin
        year
        make
        model
        trim
        mileage
        condition
        exteriorCondition
        interiorCondition
        mechanicalIssues
        referenceValue
        offerAmount
        appraisedBy { id name }
        lead { id firstName lastName email phone }
        deal { id status vehicle { year make model } }
      }
    }
  `, {}, { cache: 'no-store' })
}

export async function recordTradeInAppraisal(data: {
  id: string
  referenceValueCents: number
  offerAmountCents: number
  idempotencyKey: string
}) {
  const response = await keystoneClient(`
    mutation RecordTradeInAppraisal($data: RecordTradeInAppraisalInput!) {
      recordTradeInAppraisal(data: $data) { id referenceValue offerAmount }
    }
  `, { data })
  if (response.success) revalidatePath(TRADE_INS_PATH)
  return response
}
