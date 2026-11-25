/**
 * Calendar dates ("2026-11-25") are local, never UTC. `toISOString()` would
 * give tomorrow's date to anyone in Brazil after 21:00, and parsing
 * "2026-11-25" with `new Date()` gives yesterday — both are UTC midnight.
 */
export function toLocalISODate(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** A date-only string becomes local midnight; anything else parses as usual. */
export function parseDate(iso: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso)
}
