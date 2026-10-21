import { sanitizeStoreLogoSvg } from '@/features/lib/sanitize-store-logo';
import { DEFAULT_STORE_LOGO_ICON, normalizeStoreLogoColor } from '@/features/lib/store-logo';

export function StoreLogo({ svg, color, className = 'size-8' }: { svg: string; color: string; className?: string }) {
  const safe = sanitizeStoreLogoSvg(svg) || DEFAULT_STORE_LOGO_ICON;
  return <span aria-hidden="true" className={`inline-block shrink-0 overflow-hidden [&>svg]:block [&>svg]:size-full ${className}`}
    style={{ filter: `hue-rotate(${normalizeStoreLogoColor(color)}deg)` }} dangerouslySetInnerHTML={{ __html: safe }} />;
}
