'use client'

import { useEffect, useRef } from 'react'
import { Vehicle } from '@/features/storefront/lib/types'
import {
  dialogFocusableElements,
  inertOutsideDialog,
  isEscapeKey,
  restoreFocusAfterClose,
  trapDialogFocus,
} from '../lib/dialogAccessibility'
import { vehicleTitle } from '../lib/format'
import { DEFAULT_TEST_DRIVE_SLOTS, dayAvailability, localDateString } from '../lib/bookingSlots'
import { useStorefrontBusiness } from './StorefrontBusinessProvider'

export type LeadIntent = 'contact' | 'test-drive' | 'get-quote'

export type LeadSubmissionFeedback = {
  status: 'idle' | 'success' | 'error'
  message?: string
  reference?: string | null
}

export function LeadCaptureModal({
  vehicle,
  intent,
  onClose,
  onSubmit,
  isSubmitting,
  feedback,
  formData,
  setFormData,
  returnFocusTo,
}: {
  vehicle: Vehicle
  intent: LeadIntent
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  isSubmitting: boolean
  feedback: LeadSubmissionFeedback
  formData: {
    firstName: string
    lastName: string
    email: string
    phone: string
    message: string
    preferredDate: string
    preferredTime: string
    website: string
  }
  returnFocusTo?: HTMLElement | null
  setFormData: React.Dispatch<
    React.SetStateAction<{
      firstName: string
      lastName: string
      email: string
      phone: string
      message: string
      preferredDate: string
      preferredTime: string
      website: string
    }>
  >
}) {
  const business = useStorefrontBusiness()
  const availability = dayAvailability(business, formData.preferredDate, DEFAULT_TEST_DRIVE_SLOTS)
  const overlayRef = useRef<HTMLDivElement>(null)
  // Capture the opener during the first modal render. By the time effects run,
  // applying inert/modal focus may already have moved document.activeElement.
  const previouslyFocusedRef = useRef<HTMLElement | null>(
    typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
  )

  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) return
    const restoreBackground = inertOutsideDialog(overlay)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
      restoreBackground()
      restoreFocusAfterClose(returnFocusTo || previouslyFocusedRef.current)
    }
  }, [returnFocusTo])

  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) return
    const frame = requestAnimationFrame(() => {
      const preferred = overlay.querySelector<HTMLElement>('[data-dialog-initial-focus]')
      const target = preferred || dialogFocusableElements(overlay)[0] || overlay
      target.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [feedback.status])

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (isEscapeKey(event.key)) {
      event.preventDefault()
      event.stopPropagation()
      if (!isSubmitting) onClose()
      return
    }
    if (overlayRef.current) trapDialogFocus(event, overlayRef.current)
  }

  const titles: Record<LeadIntent, string> = {
    contact: 'Contact about this vehicle',
    'test-drive': 'Schedule a test drive',
    'get-quote': 'Request a price quote',
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4"
      style={{ background: 'oklch(0.12 0.01 75 / 0.55)' }}
      tabIndex={-1}
      onKeyDown={handleDialogKeyDown}
      data-storefront-dialog-overlay
    >
      <div
        className="sf-card max-h-[90vh] w-full overflow-y-auto p-[var(--sf-space-lg)] sm:max-w-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-modal-title"
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="sf-eyebrow mb-1">{vehicleTitle(vehicle)}</p>
            <h2 id="lead-modal-title" className="sf-display text-[length:var(--sf-text-xl)]">
              {titles[intent]}
            </h2>
          </div>
          <button type="button" onClick={onClose} disabled={isSubmitting} className="p-1 text-[var(--sf-ink-3)] hover:text-[var(--sf-ink)] disabled:opacity-50" aria-label="Close">
            ×
          </button>
        </div>

        {feedback.status === 'success' ? (
          <div className="space-y-4" role="status" aria-live="polite">
            <p className="font-semibold">Request received</p>
            <p className="text-[var(--sf-text-sm)]" style={{ color: 'var(--sf-ink-2)' }}>
              {feedback.message}
            </p>
            {feedback.reference && <p className="sf-eyebrow">Reference {feedback.reference}</p>}
            <button type="button" onClick={onClose} className="sf-btn sf-btn-primary w-full" data-dialog-initial-focus>Done</button>
          </div>
        ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label htmlFor="lead-first-name" className="sf-eyebrow block mb-1">First name</label><input
              id="lead-first-name"
              type="text"
              placeholder="First name"
              value={formData.firstName}
              onChange={(e) => setFormData((p) => ({ ...p, firstName: e.target.value }))}
              className="sf-input"
              required
              data-dialog-initial-focus
            /></div>
            <div><label htmlFor="lead-last-name" className="sf-eyebrow block mb-1">Last name</label><input
              id="lead-last-name"
              type="text"
              placeholder="Last name"
              value={formData.lastName}
              onChange={(e) => setFormData((p) => ({ ...p, lastName: e.target.value }))}
              className="sf-input"
              required
            /></div>
          </div>
          <label htmlFor="lead-email" className="sf-eyebrow block mb-1">Email</label><input
            id="lead-email"
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
            className="sf-input"
            required
          />
          <label htmlFor="lead-phone" className="sf-eyebrow block mb-1">Phone</label><input
            id="lead-phone"
            type="tel"
            placeholder="Phone"
            value={formData.phone}
            onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
            className="sf-input"
            required
          />

          {intent === 'test-drive' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="lead-preferred-date" className="sf-eyebrow block mb-1">Date</label>
                <input
                  id="lead-preferred-date"
                  type="date"
                  value={formData.preferredDate}
                  onChange={(e) => setFormData((p) => ({ ...p, preferredDate: e.target.value, preferredTime: '' }))}
                  className="sf-input"
                  required
                  min={localDateString(new Date(), business.timezone)}
                />
              </div>
              <div>
                <label htmlFor="lead-preferred-time" className="sf-eyebrow block mb-1">Time</label>
                <select
                  id="lead-preferred-time"
                  value={formData.preferredTime}
                  onChange={(e) => setFormData((p) => ({ ...p, preferredTime: e.target.value }))}
                  className="sf-input"
                  required
                >
                  <option value="">Select</option>
                  {availability.status === 'open' && availability.slots.map((slot) => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </select>
                {availability.status === 'closed' && formData.preferredDate && (
                  <p role="alert" className="mt-1 text-[var(--sf-text-xs)]">We&apos;re closed on this day.</p>
                )}
              </div>
            </div>
          )}

          <input
            type="text"
            name="website"
            value={formData.website}
            onChange={(e) => setFormData((p) => ({ ...p, website: e.target.value }))}
            tabIndex={-1}
            autoComplete="off"
            className="hidden"
            aria-hidden="true"
          />

          <label htmlFor="lead-message" className="sf-eyebrow block mb-1">{intent === 'contact' ? 'Vehicle question' : 'Message'}</label><textarea
            id="lead-message"
            placeholder={intent === 'contact' ? 'What would you like to know?' : 'Message (optional)'}
            value={formData.message}
            onChange={(e) => setFormData((p) => ({ ...p, message: e.target.value }))}
            rows={3}
            className="sf-input resize-y"
            required={intent === 'contact'}
          />

          {feedback.status === 'error' && (
            <p role="alert" className="text-[var(--sf-text-sm)]" style={{ color: 'oklch(0.45 0.15 25)' }}>
              {feedback.message || 'Something went wrong. Please try again.'}
            </p>
          )}

          <button type="submit" disabled={isSubmitting} className="sf-btn sf-btn-primary w-full">
            {isSubmitting ? 'Sending…' : 'Submit request'}
          </button>
        </form>
        )}
      </div>
    </div>
  )
}
