// Attribution for the bundled vehicle photos in public/images.
export type PhotoAttribution = {
  path: string
  vehicle: string
  title: string
  author: string
  sourceUrl: string
  license: string
  licenseUrl: string
  changes: string
}

export const BUILT_IN_PHOTO_ATTRIBUTIONS: readonly PhotoAttribution[] = [
  {
    path: '/images/luxury-sedan.jpg',
    vehicle: '2024 BMW 530i M Sport',
    title: 'BMW G30 LCI 530i M Sport Carbon Black Metallic (7).jpg',
    author: 'Damian B Oh',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:BMW_G30_LCI_530i_M_Sport_Carbon_Black_Metallic_(7).jpg',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    changes: 'Cropped to 16:10, resized to 1600×1000, recompressed, metadata removed.',
  },
  {
    path: '/images/family-suv.jpg',
    vehicle: '2023 Toyota Highlander Limited AWD',
    title: 'Toyota Highlander Hybrid (XU70) 1X7A6356.jpg',
    author: 'Alexander Migl',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Toyota_Highlander_Hybrid_(XU70)_1X7A6356.jpg',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    changes: 'Cropped to 16:10, resized to 1600×1000, recompressed, metadata removed.',
  },
  {
    path: '/images/electric-coupe.jpg',
    vehicle: '2025 Ford Mustang Mach-E Premium',
    title: 'Ford Mustang Mach-E RWD (51423802260).jpg',
    author: 'Alexandre Prévot',
    sourceUrl: 'https://commons.wikimedia.org/w/index.php?curid=113670975',
    license: 'CC BY-SA 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/',
    changes: 'Cropped to exclude the source watermark and normalize to 16:10, resized to 1600×1000, recompressed, metadata removed.',
  },
]

// Matches only the root-relative built-in paths, so an uploaded or remote
// image that happens to share a file name is never credited to these authors.
export function photoAttributionFor(src?: string | null): PhotoAttribution | null {
  if (!src) return null
  const path = src.split(/[?#]/)[0]
  return BUILT_IN_PHOTO_ATTRIBUTIONS.find((photo) => photo.path === path) ?? null
}
