import type { DeskTone } from '@/features/platform/components/desk'

export const DEAL_STATUSES = ['pencil', 'submitted', 'approved', 'financed', 'delivered', 'cancelled'] as const

export const dealStatusTone: Record<string, DeskTone> = {
  pencil: 'idle',
  submitted: 'warn',
  approved: 'info',
  financed: 'info',
  delivered: 'ok',
  cancelled: 'bad',
}

export const dealStatusLabel: Record<string, string> = {
  pencil: 'Pencil',
  submitted: 'Submitted',
  approved: 'Approved',
  financed: 'Financed',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

export function toneForDeal(status: string): DeskTone {
  return dealStatusTone[status] ?? 'idle'
}

export function labelForDeal(status: string) {
  return dealStatusLabel[status] ?? status
}
