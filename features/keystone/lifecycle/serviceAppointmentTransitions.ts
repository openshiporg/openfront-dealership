export const SERVICE_APPOINTMENT_TRANSITIONS: Record<string, readonly string[]> = {
  scheduled: ['checked-in', 'cancelled'],
  'checked-in': ['in-progress', 'waiting-parts', 'cancelled'],
  'in-progress': ['waiting-parts', 'completed'],
  'waiting-parts': ['in-progress', 'completed'],
  completed: [],
  cancelled: [],
}
