export function partitionSavedVehicleResults<T extends { id: string }>(ids: readonly string[], results: readonly unknown[]) {
  if (ids.length !== results.length) throw new Error('Incomplete public inventory lookup response.')

  const vehicles: T[] = []
  const unavailableIds: string[] = []

  ids.forEach((id, index) => {
    const result = results[index]
    if (!result || typeof result !== 'object' || !Object.prototype.hasOwnProperty.call(result, 'publicInventoryVehicle')) {
      throw new Error('Invalid public inventory lookup response.')
    }

    const vehicle = (result as { publicInventoryVehicle?: T | null }).publicInventoryVehicle
    if (vehicle === null) {
      unavailableIds.push(id)
    } else if (!vehicle || typeof vehicle !== 'object' || typeof vehicle.id !== 'string') {
      throw new Error('Invalid public inventory vehicle response.')
    } else {
      vehicles.push(vehicle)
    }
  })

  return { vehicles, unavailableIds }
}
