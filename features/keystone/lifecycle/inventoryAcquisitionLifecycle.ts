export type InventoryAcquisitionStatus =
  | 'appraised'
  | 'approved'
  | 'purchased'
  | 'arrived'
  | 'reconditioning'
  | 'frontline'
  | 'cancelled'

const NEXT: Record<InventoryAcquisitionStatus, InventoryAcquisitionStatus[]> = {
  appraised: ['approved', 'cancelled'],
  approved: ['purchased', 'cancelled'],
  purchased: ['arrived', 'cancelled'],
  arrived: ['reconditioning', 'cancelled'],
  reconditioning: ['frontline', 'cancelled'],
  frontline: [],
  cancelled: [],
}

export function assertInventoryAcquisitionTransition(from: string, to: string) {
  if (from === 'frontline' || from === 'cancelled') {
    throw new Error(`Inventory acquisition status ${from} is terminal`)
  }
  if (!NEXT[from as InventoryAcquisitionStatus]?.includes(to as InventoryAcquisitionStatus)) {
    throw new Error(`Invalid inventory acquisition transition: ${from} -> ${to}`)
  }
}

export function buildAcquisitionEvidence(input: Record<string, unknown>) {
  return {
    version: 1,
    reference: String(input.reference || ''),
    rooftopId: String(input.rooftopId || ''),
    vehicleIdentity: {
      vin: String(input.vin || ''),
      year: Number(input.year || 0),
      make: String(input.make || ''),
      model: String(input.model || ''),
    },
    acquisitionSource: String(input.acquisitionSource || ''),
    appraisalCents: Number(input.appraisalCents || 0),
    purchaseCents: Number(input.purchaseCents || 0),
    reconEstimateCents: Number(input.reconEstimateCents || 0),
  }
}
