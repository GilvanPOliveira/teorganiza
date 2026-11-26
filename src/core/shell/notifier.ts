import { useEffect } from 'react'
import { toLocalISODate } from '@core/api/dates'
import { collectDated } from '@core/providers/collect'

const NOTIFIED_KEY = 'teorganiza.notified'
const CHECK_EVERY_MS = 30_000
/** An entry is announced when its time arrives, or up to this late (a sleeping laptop). */
const GRACE_MINUTES = 10

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export async function requestNotifications(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported'
  return Notification.requestPermission()
}

function notified(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(NOTIFIED_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

function remember(keys: Set<string>): void {
  try {
    sessionStorage.setItem(NOTIFIED_KEY, JSON.stringify([...keys]))
  } catch {
    // Without storage an entry may be announced twice; never zero times.
  }
}

/** Minutes since midnight of an 'HH:MM'. */
function minutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/**
 * While the app is open, announces each of today's entries with a time
 * (an event, a reminder, a dose) when that time arrives. Announcing with
 * the app closed would need a push server; this needs nothing.
 */
export function useDayNotifier(): void {
  useEffect(() => {
    if (!notificationsSupported()) return
    const check = async () => {
      if (Notification.permission !== 'granted') return
      const today = toLocalISODate()
      const now = new Date()
      const current = now.getHours() * 60 + now.getMinutes()
      const seen = notified()
      const entries = await collectDated({ from: today, to: today })
      for (const entry of entries) {
        if (!entry.time || entry.done) continue
        const at = minutes(entry.time)
        const key = `${today}:${entry.key}:${entry.time}`
        if (at <= current && current - at <= GRACE_MINUTES && !seen.has(key)) {
          new Notification(entry.title, { body: `${entry.kind} · ${entry.time}`, tag: key })
          seen.add(key)
        }
      }
      remember(seen)
    }
    void check()
    const timer = window.setInterval(() => void check(), CHECK_EVERY_MS)
    return () => window.clearInterval(timer)
  }, [])
}
