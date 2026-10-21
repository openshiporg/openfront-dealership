export function VehiclePhotoPlaceholder({ className = '' }: { className?: string }) {
  return (
    <div className={`absolute inset-0 flex items-center justify-center ${className}`} style={{ color: 'var(--sf-ink-3)' }}>
      <svg aria-hidden="true" width="96" height="48" viewBox="0 0 96 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" className="opacity-60">
        <path d="M8 34v-8l10-4 12-10h28l14 10 14 3v9H8z" />
        <circle cx="26" cy="36" r="6" fill="var(--sf-paper-2)" />
        <circle cx="72" cy="36" r="6" fill="var(--sf-paper-2)" />
      </svg>
    </div>
  )
}
