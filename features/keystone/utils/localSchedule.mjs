// Convert civil dealership time without depending on the server's timezone.
// Reject DST gaps/folds instead of silently choosing a different appointment.
export function localScheduleIso(date, hours, minutes, timezone) {
  const [year, month, day] = date.split('-').map(Number)
  const civil = Date.UTC(year, month - 1, day, hours, minutes)
  const format = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  })
  const parts = timestamp => Object.fromEntries(format.formatToParts(timestamp).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]))
  const candidates = new Set()
  for (const delta of [-36, -24, -12, 0, 12, 24, 36]) {
    const sample = civil + delta * 3600000
    const p = parts(sample)
    const offset = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - sample
    const candidate = civil - offset
    const c = parts(candidate)
    if (c.year === year && c.month === month && c.day === day && c.hour === hours && c.minute === minutes) candidates.add(candidate)
  }
  if (candidates.size !== 1) throw new Error('Date/time does not identify one valid local appointment; choose another time.')
  return new Date([...candidates][0]).toISOString()
}
