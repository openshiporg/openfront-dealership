/** Recorded by staff at delivery. */
export const DELIVERY_CHECKLIST_ITEMS = [
  { code: 'identity', label: 'Identity' },
  { code: 'insurance', label: 'Insurance' },
  { code: 'registration', label: 'Registration' },
  { code: 'title-handoff', label: 'Title handoff' },
] as const

/**
 * Funding is the fifth checklist item, but staff never record it here: the server attaches it from
 * the current funding case (funded, or payment received on a cash sale) at customer acknowledgment.
 */
export const DELIVERY_FUNDING_ITEM = { code: 'funding', label: 'Funding' } as const

export function buildDeliveryChecklistEntry(code: string, evidenceReference: string) {
  if (!DELIVERY_CHECKLIST_ITEMS.some(item => item.code === code)) {
    throw new Error('Select one valid delivery checklist item.')
  }

  const reference = evidenceReference.trim()
  if (!reference || reference.length > 200) {
    throw new Error('A reference for this checklist item is required (maximum 200 characters).')
  }

  return { code, status: 'complete' as const, evidenceReference: reference }
}

/** A staff-recorded checklist item can be waived; the waiver reason is kept as its evidence reference. */
export function buildDeliveryWaiverEntry(code: string, reason: string) {
  if (!DELIVERY_CHECKLIST_ITEMS.some(item => item.code === code)) {
    throw new Error('Select one valid delivery checklist item.')
  }

  const text = reason.trim()
  if (!text || text.length > 200) {
    throw new Error('A waiver reason is required (maximum 200 characters).')
  }

  return { code, status: 'waived' as const, evidenceReference: text }
}
