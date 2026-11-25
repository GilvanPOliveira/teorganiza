import type { Envelope } from '@core/api/types'

/**
 * UUID v7: the first 48 bits are the timestamp, so ids sort by creation
 * time without an extra index, and two offline devices never collide.
 */
export function uuidv7(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)

  const ms = BigInt(Date.now())
  bytes[0] = Number((ms >> 40n) & 0xffn)
  bytes[1] = Number((ms >> 32n) & 0xffn)
  bytes[2] = Number((ms >> 24n) & 0xffn)
  bytes[3] = Number((ms >> 16n) & 0xffn)
  bytes[4] = Number((ms >> 8n) & 0xffn)
  bytes[5] = Number(ms & 0xffn)

  bytes[6] = (bytes[6] & 0x0f) | 0x70 // version 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // RFC 4122 variant

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function newEnvelope<T>(
  data: T,
  schemaVersion: number,
  deviceId: string,
): Envelope<T> {
  const now = new Date().toISOString()
  return {
    id: uuidv7(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deviceId,
    rev: 1,
    schemaVersion,
    data,
  }
}

export function touchEnvelope<T>(
  previous: Envelope<T>,
  data: T,
  deviceId: string,
): Envelope<T> {
  return {
    ...previous,
    data,
    deviceId,
    rev: previous.rev + 1,
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Delete never removes the row. A missing record is indistinguishable from
 * one the other device has not seen yet, and the merge would resurrect it.
 */
export function tombstoneEnvelope<T>(
  previous: Envelope<T>,
  deviceId: string,
): Envelope<T> {
  const now = new Date().toISOString()
  return {
    ...previous,
    deviceId,
    rev: previous.rev + 1,
    updatedAt: now,
    deletedAt: now,
  }
}
