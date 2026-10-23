export type PublicFeedRunCandidate = {
  inventoryStockId: string
  status: string
  reconStatus: string
  merchandisingStatus: string
  frontlineAt: string | Date | null
  /** The storefront gate's verdict; units it rejects would fail the whole feed run. */
  publicListing?: { live: boolean }
}

export function selectPublicFeedRunCandidates<T extends PublicFeedRunCandidate>(vehicles: readonly T[]) {
  return vehicles.filter(vehicle =>
    vehicle.status === 'available' &&
    vehicle.reconStatus === 'completed' &&
    vehicle.merchandisingStatus === 'approved' &&
    Boolean(vehicle.frontlineAt) &&
    vehicle.publicListing?.live !== false
  )
}
