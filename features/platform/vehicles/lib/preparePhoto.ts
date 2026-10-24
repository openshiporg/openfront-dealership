/** Formats `VehicleImage.image` storage accepts (Keystone image field). */
const STORED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
/** Stays under the 10 MB server action body limit in next.config.ts. */
const MAX_UPLOAD_BYTES = 9 * 1024 * 1024
const MAX_EDGE = 2400

export const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif'

/**
 * Returns a file the bucket accepts: supported files under the size limit go as-is; anything larger, or
 * in a format the browser can decode but storage cannot (HEIC on Safari), is re-encoded as JPEG.
 */
export async function preparePhoto(file: File): Promise<File> {
  if (STORED_TYPES.has(file.type) && file.size <= MAX_UPLOAD_BYTES) return file
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error(`${file.name}: use a JPG, PNG, WebP or GIF photo.`)
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  if (!blob || blob.size > MAX_UPLOAD_BYTES) throw new Error(`${file.name}: photo is too large.`)
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'photo'}.jpg`, { type: 'image/jpeg' })
}
