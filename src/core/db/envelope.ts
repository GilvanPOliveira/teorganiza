import type { Envelope } from '@core/api/types'

let lastMs = -1
let counter = 0

/**
 * UUID v7: the first 48 bits are the timestamp, so ids sort by creation
 * time without an extra index, and two offline devices never collide.
 *
 * Within the same millisecond the 12 bits after the version (`rand_a`)
 * are a counter instead of random (RFC 9562, method 1), so ids made on
 * this device always sort in the order they were made. The counter starts
 * at a random point below half its range, leaving room to count; when it
 * runs out, the timestamp borrows the next millisecond.
 */
export function uuidv7(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)

  let now = Date.now()
  if (now > lastMs) {
    lastMs = now
    counter = ((bytes[6] << 8) | bytes[7]) & 0x7ff
  } else {
    now = lastMs // clock stood still or went back: never sort backwards
    counter++
    if (counter > 0xfff) {
      lastMs = now = lastMs + 1
      counter = 0
    }
  }

  const ms = BigInt(now)
  bytes[0] = Number((ms >> 40n) & 0xffn)
  bytes[1] = Number((ms >> 32n) & 0xffn)
  bytes[2] = Number((ms >> 24n) & 0xffn)
  bytes[3] = Number((ms >> 16n) & 0xffn)
  bytes[4] = Number((ms >> 8n) & 0xffn)
  bytes[5] = Number(ms & 0xffn)

  bytes[6] = 0x70 | (counter >> 8) // version 7 + counter high bits
  bytes[7] = counter & 0xff
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
    tags: [],
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

/** Undoes a tombstone. To the merge it is an ordinary edit. */
export function restoreEnvelope<T>(previous: Envelope<T>, deviceId: string): Envelope<T> {
  return {
    ...previous,
    deviceId,
    rev: previous.rev + 1,
    updatedAt: new Date().toISOString(),
    deletedAt: null,
  }
}

/** Replaces the tag set. An ordinary edit to the merge. */
export function retagEnvelope<T>(
  previous: Envelope<T>,
  tags: string[],
  deviceId: string,
): Envelope<T> {
  return {
    ...previous,
    tags,
    deviceId,
    rev: previous.rev + 1,
    updatedAt: new Date().toISOString(),
  }
}

/** A tag list as a set: sorted, without duplicates, `[]` for missing. */
export function normalizeTags(tags: readonly string[] | undefined): string[] {
  return [...new Set(tags ?? [])].sort()
}
