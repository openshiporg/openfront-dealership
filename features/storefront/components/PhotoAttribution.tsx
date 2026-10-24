import Link from 'next/link'

import { photoAttributionFor } from '../lib/photoAttribution'

// Credit line for a bundled photo; renders nothing for any other image.
// Keep it outside image links so its own links are never nested in another <a>.
export function PhotoAttribution({ src, className = '' }: { src?: string | null; className?: string }) {
  const photo = photoAttributionFor(src)
  if (!photo) return null

  return (
    <p className={`text-[length:var(--sf-text-xs)] leading-snug ${className}`} style={{ color: 'var(--sf-ink-3)' }}>
      Photo:{' '}
      <a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
        {photo.author}
      </a>
      ,{' '}
      <a href={photo.licenseUrl} target="_blank" rel="license noopener noreferrer" className="underline underline-offset-2">
        {photo.license}
      </a>
      , modified.{' '}
      <Link href="/photo-credits" className="underline underline-offset-2">
        Credits
      </Link>
    </p>
  )
}
