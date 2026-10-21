export function storefrontCurrency(currencyCode?: string | null) {
  const code = String(currencyCode || '').trim().toUpperCase()
  return /^[A-Z]{3}$/.test(code) ? code : 'USD'
}

export function currencySymbol(currencyCode?: string | null) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: storefrontCurrency(currencyCode) })
    .formatToParts(0)
    .find((part) => part.type === 'currency')?.value ?? '$'
}

export function formatPrice(price: number, currencyCode?: string | null) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: storefrontCurrency(currencyCode),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)
}

export function formatMileage(mileage: number) {
  return `${new Intl.NumberFormat('en-US').format(mileage)} mi`
}

export function vehicleTitle(vehicle: { year: number; make: string; model: string; trim?: string }) {
  const base = `${vehicle.year} ${vehicle.make} ${vehicle.model}`
  return vehicle.trim ? `${base} ${vehicle.trim}` : base
}
