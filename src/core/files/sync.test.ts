import { describe, expect, it } from 'vitest'
import type { StorageAdapter } from '@core/storage/types'
import { getBlob, hashBlob, putBlob } from './blobs'
import { syncBlobs } from './sync'

function remoteFolder(initial: Record<string, Blob> = {}) {
  const files = new Map(Object.entries(initial))
  const adapter = {
    listBlobs: async () => [...files.keys()],
    readBlob: async (hash: string) => files.get(hash) ?? null,
    writeBlob: async (hash: string, blob: Blob) => void files.set(hash, blob),
  } as unknown as StorageAdapter
  return { adapter, files }
}

describe('file contents sync', () => {
  it('sends what only this device has and fetches what only the destination has', async () => {
    const mine = new Blob(['comprovante'], { type: 'text/plain' })
    const theirs = new Blob(['contrato'], { type: 'text/plain' })
    const mineHash = await putBlob(mine)
    const theirsHash = await hashBlob(theirs)
    const { adapter, files } = remoteFolder({ [theirsHash]: theirs })

    const result = await syncBlobs(adapter, new Set([mineHash, theirsHash]))

    expect(result).toEqual({ sent: 1, received: 1, missing: 0 })
    expect(files.has(mineHash)).toBe(true)
    expect(await (await getBlob(theirsHash))!.text()).toBe('contrato')
  })

  it('counts a file nobody has yet as missing, and sends nothing unwanted', async () => {
    const loose = await putBlob(new Blob(['rascunho']))
    const { adapter, files } = remoteFolder()
    const result = await syncBlobs(adapter, new Set(['f'.repeat(64)]))
    expect(result).toEqual({ sent: 0, received: 0, missing: 1 })
    expect(files.has(loose)).toBe(false)
  })

  it('does nothing with a destination that keeps no files', async () => {
    const result = await syncBlobs({} as StorageAdapter, new Set(['a'.repeat(64)]))
    expect(result).toEqual({ sent: 0, received: 0, missing: 0 })
  })
})
