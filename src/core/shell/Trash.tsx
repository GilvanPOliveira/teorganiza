import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Hash, RotateCcw } from 'lucide-react'
import { useFormat } from '@core/api/hooks'
import type { Envelope } from '@core/api/types'
import { Button, EmptyState } from '@core/api/ui'
import { CORE_MODULE_ID } from '@core/collections'
import { readAll, restoreRecord } from '@core/db/repository'
import { getCollections, getModule } from '@core/registry/registry'
import { useAppState } from '@core/runtime/app-context'
import { ModuleIcon } from './ModuleIcon'
import { useCoreT } from './useShell'

/** Of the core's own collections, only tags are something a person deletes. */
const TRASHABLE_CORE = new Set(['tags'])

interface TrashEntry {
  path: string
  moduleId: string
  record: Envelope<unknown>
  label: string
}

/**
 * Nothing is ever deleted — every delete is a tombstone — so the trash is
 * just the tombstones, newest first. Restoring is an ordinary edit, and it
 * syncs like one. Of the core's own collections only tags show up: a
 * removed widget is not something anyone wants back from a trash.
 */
async function readTrash(): Promise<TrashEntry[]> {
  const entries: TrashEntry[] = []
  for (const { path, moduleId, def } of getCollections()) {
    if (moduleId === CORE_MODULE_ID && !TRASHABLE_CORE.has(def.name)) continue
    const rows = await readAll<unknown>(path, { includeDeleted: true })
    for (const record of rows) {
      if (record.deletedAt === null) continue
      entries.push({ path, moduleId, record, label: describeSafely(def.describe, record) })
    }
  }
  return entries.sort((a, b) => b.record.deletedAt!.localeCompare(a.record.deletedAt!))
}

function describeSafely(describe: (record: Envelope<unknown>) => string, record: Envelope<unknown>) {
  try {
    return describe(record)
  } catch {
    return record.id
  }
}

export function Trash() {
  const t = useCoreT()
  const format = useFormat()
  const { deviceId } = useAppState()
  const entries = useLiveQuery(readTrash, [])

  return (
    <div className="to-settings">
      <Link to="/settings" className="to-backlink">
        <ArrowLeft size={16} />
        {t('nav.settings')}
      </Link>
      <h1 className="to-settings__title">{t('trash.title')}</h1>
      <p className="to-muted">{t('trash.body')}</p>

      {entries === undefined ? null : entries.length === 0 ? (
        <EmptyState title={t('trash.empty')} />
      ) : (
        <ul className="to-trash">
          {entries.map(({ path, moduleId, record, label }) => {
            const mod = getModule(moduleId)
            const isTag = moduleId === CORE_MODULE_ID
            const origin = mod?.name ?? (isTag ? t('tags.title') : moduleId)
            return (
              <li key={`${path}/${record.id}`} className="to-trash__item">
                <ModuleIcon icon={mod?.icon ?? (isTag ? Hash : undefined)} label={origin} size={16} boxed />
                <span className="to-trash__text">
                  <span className="to-trash__label">{label}</span>
                  <span className="to-muted">
                    {origin} · {t('trash.deleted', { when: format.relative(record.deletedAt!) })}
                  </span>
                </span>
                <Button onClick={() => void restoreRecord(path, record.id, deviceId)}>
                  <RotateCcw size={15} />
                  {t('trash.restore')}
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
