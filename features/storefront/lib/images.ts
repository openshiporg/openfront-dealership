import type { VehicleImage } from '@/features/storefront/lib/types'

export function vehicleImageUrl(image?: VehicleImage | null) {
  return image?.imagePath || image?.image?.url || null
}

export function primaryVehicleImage(images?: VehicleImage[] | null) {
  return images?.find((image) => image.isPrimary) ?? images?.[0] ?? null
}
