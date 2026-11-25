import { describe, expect, it } from 'vitest'
import {
  LEASE_TTL_MS,
  evaluateLease,
  nextLease,
  parseLease,
  releasedLease,
  type Lease,
} from '@core/sync/lock'

const now = new Date('2026-11-22T18:52:00.000Z')
const pc = { deviceId: 'pc', nickname: 'PC casa' }
const lease: Lease = {
  ...pc,
  acquiredAt: '2026-11-22T18:40:00.000Z',
  expiresAt: '2026-11-22T19:10:00.000Z',
}

describe('lease', () => {
  it('no lease or an expired one is free', () => {
    expect(evaluateLease(null, 'phone', now)).toBe('free')
    expect(evaluateLease(lease, 'phone', new Date('2026-11-22T19:10:00.000Z'))).toBe('free')
  })

  it('our own active lease is ours', () => {
    expect(evaluateLease(lease, 'pc', now)).toBe('ours')
  })

  it("another device's active lease says who and since when", () => {
    expect(evaluateLease(lease, 'phone', now)).toEqual({ held: false, by: pc, since: lease.acquiredAt })
  })

  it('a new lease lasts the TTL; a renewal keeps its start', () => {
    const fresh = nextLease(null, pc, now)
    expect(fresh.acquiredAt).toBe(now.toISOString())
    expect(Date.parse(fresh.expiresAt) - now.getTime()).toBe(LEASE_TTL_MS)
    expect(nextLease(lease, pc, now).acquiredAt).toBe(lease.acquiredAt)
    expect(nextLease(lease, { deviceId: 'phone', nickname: 'x' }, now).acquiredAt).toBe(now.toISOString())
  })

  it('released means expired now', () => {
    expect(evaluateLease(releasedLease(lease, now), 'phone', now)).toBe('free')
  })

  it('a malformed lock file reads as no lease', () => {
    expect(parseLease(null)).toBeNull()
    expect(parseLease({ deviceId: 'pc' })).toBeNull()
    expect(parseLease({ ...lease, expiresAt: 'soon' })).toBeNull()
    expect(parseLease(lease)).toEqual(lease)
  })
})
