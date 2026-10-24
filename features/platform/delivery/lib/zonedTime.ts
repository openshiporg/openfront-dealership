/** `datetime-local` values read and written in the dealership's time zone, not the browser's. */

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: string) => Number(parts.find(part => part.type === type)?.value)
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') }
}

function offsetMs(utcMs: number, timeZone: string) {
  const p = zonedParts(new Date(utcMs), timeZone)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(utcMs / 1000) * 1000
}

/** "2026-10-24T09:30" for a moment, as wall-clock time in `timeZone`. */
export function zonedInputValue(date: Date, timeZone: string) {
  const p = zonedParts(date, timeZone)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`
}

/** The moment a `datetime-local` value names in `timeZone`, or null if it is not a valid value. */
export function fromZonedInput(value: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const [, year, month, day, hour, minute] = match.map(Number)
  const wall = Date.UTC(year, month - 1, day, hour, minute)
  // Two passes settle the offset across a DST change.
  let utc = wall - offsetMs(wall, timeZone)
  utc = wall - offsetMs(utc, timeZone)
  const result = new Date(utc)
  return Number.isNaN(result.getTime()) ? null : result
}
