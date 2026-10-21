export const DELIVERY_CHECKLIST_ITEMS = [
  { code: 'identity', label: 'Identity' },
  { code: 'insurance', label: 'Insurance' },
  { code: 'registration', label: 'Registration' },
  { code: 'title-handoff', label: 'Title handoff' },
  { code: 'funding', label: 'Funding' },
] as const

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
