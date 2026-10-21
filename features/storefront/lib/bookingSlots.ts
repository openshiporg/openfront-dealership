import type { StorefrontBusiness } from './business'

export const DEFAULT_TEST_DRIVE_SLOTS = ['9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM']
export const DEFAULT_SERVICE_SLOTS = ['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM']

type Hours = Pick<StorefrontBusiness, 'hoursMonFri' | 'hoursSaturday' | 'hoursSunday'> & { timezone?: string }

export type DayAvailability =
  | { status: 'closed' }
  | { status: 'open'; slots: string[] }

const TIME_PATTERN = /(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)/gi

function toMinutes(hour: string, minute: string | undefined, meridiem: string) {
  const h = Number(hour) % 12
  const pm = meridiem.toLowerCase().startsWith('p')
  return (pm ? h + 12 : h) * 60 + Number(minute || 0)
}

function slotLabel(minutes: number) {
  const h24 = Math.floor(minutes / 60)
  const m = minutes % 60
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`
}

export function slotMinutes(label: string) {
  const match = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(label)
  return match ? toMinutes(match[1], match[2], match[3]) : null
}

function hoursForDate(hours: Hours, date: string) {
  const [year, month, day] = date.split('-').map(Number)
  const weekday = new Date(year, month - 1, day).getDay()
  if (weekday === 0) return hours.hoursSunday
  if (weekday === 6) return hours.hoursSaturday
  return hours.hoursMonFri
}

// Store hours are free text; derive slots only when the text names a closed day
// or an opening and closing time. Anything else falls back to the default slots.
export function dayAvailability(hours: Hours, date: string, defaultSlots: string[]): DayAvailability {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { status: 'open', slots: defaultSlots }
  const text = hoursForDate(hours, date).trim()
  if (/\bclosed\b/i.test(text)) return { status: 'closed' }

  const times = Array.from(text.matchAll(TIME_PATTERN)).map((match) => toMinutes(match[1], match[2], match[3]))
  let slots = defaultSlots
  if (times.length >= 2 && times[1] > times[0]) {
    const [open, close] = times
    slots = []
    for (let minutes = Math.ceil(open / 60) * 60; minutes + 60 <= close; minutes += 60) slots.push(slotLabel(minutes))
  }

  if (date === localDateString(new Date(), hours.timezone)) {
    const nowMinutes = minutesOfDay(new Date(), hours.timezone)
    slots = slots.filter((slot) => (slotMinutes(slot) ?? 0) > nowMinutes)
  }
  return slots.length ? { status: 'open', slots } : { status: 'closed' }
}

function zonedParts(date: Date, timeZone?: string) {
  try {
    if (timeZone) {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
      }).formatToParts(date)
      const part = (type: string) => Number(parts.find((item) => item.type === type)?.value)
      return { year: part('year'), month: part('month'), day: part('day'), hour: part('hour'), minute: part('minute') }
    }
  } catch {
    // An unknown time zone falls back to the browser's local time.
  }
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(), hour: date.getHours(), minute: date.getMinutes() }
}

function minutesOfDay(date: Date, timeZone?: string) {
  const { hour, minute } = zonedParts(date, timeZone)
  return hour * 60 + minute
}

// Today's date at the dealership (its rooftop time zone when known).
export function localDateString(date = new Date(), timeZone?: string) {
  const { year, month, day } = zonedParts(date, timeZone)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
