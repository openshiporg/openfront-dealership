/**
 * Appends a PriceHistory row when a command changes Vehicle.priceCents. Runs inside the command's
 * transaction so the log and the price move together. Returns whether a row was written.
 */
export async function appendInventoryPriceHistory(tx: any, input: {
  rooftopId: string
  vehicleId: string
  previousPriceCents: number | null | undefined
  newPriceCents: number
  actorId: string | null | undefined
  changeReason: string
  notes?: string
  effectiveDate?: Date
}) {
  const previous = input.previousPriceCents == null ? null : Number(input.previousPriceCents)
  if (previous === input.newPriceCents) return false
  await tx.prisma.priceHistory.create({
    data: {
      rooftopId: input.rooftopId,
      vehicleId: input.vehicleId,
      effectiveDate: input.effectiveDate ?? new Date(),
      previousPriceCents: previous,
      newPriceCents: input.newPriceCents,
      changeReason: String(input.changeReason || '').trim().slice(0, 500),
      changedById: input.actorId ?? null,
      notes: String(input.notes || '').trim().slice(0, 2_000),
    },
  })
  return true
}
