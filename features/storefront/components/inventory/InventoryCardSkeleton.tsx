// Placeholder with the same footprint as the grid VehicleCard.
export function InventoryCardSkeleton() {
  return (
    <div className="flex min-w-0 flex-col" aria-hidden="true">
      <div className="sf-skeleton aspect-[4/3] rounded-[var(--sf-radius-md)]" />
      <div className="pl-4 pt-4">
        <div className="sf-skeleton h-5 w-3/4" />
        <div className="sf-skeleton mt-2 h-4 w-1/3" />
        <div className="mt-4 flex items-baseline justify-between gap-3">
          <div className="sf-skeleton h-6 w-28" />
          <div className="sf-skeleton h-3 w-16" />
        </div>
        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="sf-skeleton h-3 w-24" />
          <div className="sf-skeleton h-11 w-28 rounded-full" />
        </div>
      </div>
    </div>
  )
}
