import { createRecord, readAll, removeRecord } from '@core/db/repository'
import { getDeviceId } from '@core/device'

/**
 * Moves data between modules when the app's shape changes. It lives here,
 * at the composition root, because only this level may know modules by
 * name; `core/` never does.
 *
 * Each move is idempotent: it acts only on rows still in the old place,
 * and leaves a tombstone there, which sync carries to the other devices.
 */
export async function runMigrations(): Promise<void> {
  await moveMediaToShelf()
}

interface LegacyList {
  kind: string
}
interface LegacyItem {
  listId: string | null
  title: string
  status: 'todo' | 'doing' | 'done'
  done: boolean
}

/** "Filmes e Séries" was a checklist in `lists`; it is now `reading/media`, with states. */
async function moveMediaToShelf(): Promise<void> {
  const lists = await readAll<LegacyList>('lists/lists')
  const mediaLists = new Set(lists.filter((list) => list.data.kind === 'media').map((list) => list.id))
  if (mediaLists.size === 0) return

  const deviceId = getDeviceId()
  const items = await readAll<LegacyItem>('lists/items')
  for (const item of items) {
    if (!item.data.listId || !mediaLists.has(item.data.listId)) continue
    await createRecord(
      'reading/media',
      {
        title: item.data.title,
        kind: 'movie',
        status: item.data.done ? 'done' : item.data.status === 'doing' ? 'doing' : 'want',
        rating: null,
        season: null,
        episode: null,
        note: '',
      },
      deviceId,
      item.tags ?? [],
    )
    await removeRecord('lists/items', item.id, deviceId)
  }
  for (const id of mediaLists) await removeRecord('lists/lists', id, deviceId)
}
