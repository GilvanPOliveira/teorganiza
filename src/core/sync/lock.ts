import type { DeviceLease, LockResult } from '@core/storage/types'

/**
 * The device lease kept in `_lock.json`. A soft lock: it lowers how often
 * conflicts happen, it never prevents them. The guarantee against losing
 * data is the etag and the merge, not this.
 */
export interface Lease extends DeviceLease {
  acquiredAt: string
  expiresAt: string
}

export const LEASE_TTL_MS = 30 * 60 * 1000
/** How often an active device renews its lease while in use. */
export const LEASE_RENEW_MS = 5 * 60 * 1000

export function isLeaseActive(lease: Lease, now: Date): boolean {
  return Date.parse(lease.expiresAt) > now.getTime()
}

/**
 * What acquiring would mean right now. An expired lease is ignored: it
 * covers the browser that closed without releasing.
 */
export function evaluateLease(
  current: Lease | null,
  deviceId: string,
  now: Date,
): 'free' | 'ours' | LockResult & { held: false } {
  if (!current || !isLeaseActive(current, now)) return 'free'
  if (current.deviceId === deviceId) return 'ours'
  return {
    held: false,
    by: { deviceId: current.deviceId, nickname: current.nickname },
    since: current.acquiredAt,
  }
}

/** A fresh lease, or the renewal of our own (keeping when it started). */
export function nextLease(current: Lease | null, device: DeviceLease, now: Date): Lease {
  const renewing = current !== null && current.deviceId === device.deviceId && isLeaseActive(current, now)
  return {
    deviceId: device.deviceId,
    nickname: device.nickname,
    acquiredAt: renewing ? current.acquiredAt : now.toISOString(),
    expiresAt: new Date(now.getTime() + LEASE_TTL_MS).toISOString(),
  }
}

/** Releasing writes an already-expired lease instead of deleting the file. */
export function releasedLease(current: Lease, now: Date): Lease {
  return { ...current, expiresAt: now.toISOString() }
}

export function parseLease(value: unknown): Lease | null {
  if (value === null || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  const fields = ['deviceId', 'nickname', 'acquiredAt', 'expiresAt'] as const
  if (!fields.every((f) => typeof v[f] === 'string')) return null
  if (Number.isNaN(Date.parse(v.expiresAt as string))) return null
  return {
    deviceId: v.deviceId as string,
    nickname: v.nickname as string,
    acquiredAt: v.acquiredAt as string,
    expiresAt: v.expiresAt as string,
  }
}
