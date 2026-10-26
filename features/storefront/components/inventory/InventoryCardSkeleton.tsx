// Placeholder with the same footprint as the grid VehicleCard.
export function InventoryCardSkeleton() {
  return (
    <div className="flex min-w-0 flex-col" aria-hidden="true">
      <div className="sf-skeleton aspect-[4/3]" />
      <div className="pt-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="sf-skeleton h-5 w-3/4" />
            <div className="sf-skeleton mt-2 h-4 w-1/3" />
          </div>
          <div className="sf-skeleton h-6 w-24" />
        </div>
        <div className="sf-skeleton mt-3 h-12 w-full" />
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="sf-skeleton h-3 w-24" />
          <div className="sf-skeleton h-9 w-28" />
        </div>
      </div>
    </div>
  )
}
