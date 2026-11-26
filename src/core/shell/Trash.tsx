import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Hash, Link2, Paperclip, RotateCcw } from 'lucide-react'
import { useFormat } from '@core/api/hooks'
import type { Envelope } from '@core/api/types'
import { Button, EmptyState } from '@core/api/ui'
import { CORE_MODULE_ID } from '@core/collections'
import { readAll, restoreRecord } from '@core/db/repository'
import { getCollections, getModule } from '@core/registry/registry'
import { useAppState } from '@core/runtime/app-context'
import { ModuleIcon } from './ModuleIcon'
import { useCoreT } from './useShell'

/** Of the core's own collections, these are things a person deletes and may want back. */
const TRASHABLE_CORE = new Set(['tags', 'files', 'links'])

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
      // Moved elsewhere by a migration: it lives on in its new place.
      if (isMoved(record)) continue
      entries.push({ path, moduleId, record, label: describeSafely(def.describe, record) })
    }
  }
  return entries.sort((a, b) => b.record.deletedAt!.localeCompare(a.record.deletedAt!))
}

const CORE_ORIGIN: Record<string, { label: string; icon: typeof Hash }> = {
  'core/tags': { label: 'tags.title', icon: Hash },
  'core/files': { label: 'trash.files', icon: Paperclip },
  'core/links': { label: 'trash.links', icon: Link2 },
}

function isMoved(record: Envelope<unknown>): boolean {
  return typeof record.data === 'object' && record.data !== null && '_movedTo' in record.data
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
            // Core rows are tags, files or links; each is named and drawn for what it is.
            const core = moduleId === CORE_MODULE_ID ? CORE_ORIGIN[path] : undefined
            const origin = mod?.name ?? (core ? t(core.label) : moduleId)
            return (
              <li key={`${path}/${record.id}`} className="to-trash__item">
                <ModuleIcon icon={mod?.icon ?? core?.icon} label={origin} size={16} boxed />
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
