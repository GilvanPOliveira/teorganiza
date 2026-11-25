import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, ChevronRight, Trash2 } from 'lucide-react'
import { useTags } from '@core/api/hooks'
import type { Envelope } from '@core/api/types'
import { EmptyState } from '@core/api/ui'
import { ACCENTS, CORE_MODULE_ID } from '@core/collections'
import { readAll, removeRecord, updateRecord } from '@core/db/repository'
import { getCollections, getModule } from '@core/registry/registry'
import { useAppState } from '@core/runtime/app-context'
import { ModuleIcon } from './ModuleIcon'
import { useCoreT } from './useShell'

const TAGS_PATH = 'core/tags'

interface Tagged {
  path: string
  moduleId: string
  record: Envelope<unknown>
  label: string
}

/**
 * The core can read every collection — only modules cannot read each
 * other — so "everything tagged X" is one query per collection, with no
 * module taking part beyond its `describe`.
 */
async function readTagged(tagId: string | null): Promise<Tagged[]> {
  const found: Tagged[] = []
  for (const { path, moduleId, def } of getCollections()) {
    if (moduleId === CORE_MODULE_ID) continue
    const rows = await readAll<unknown>(path, tagId ? { tag: tagId } : undefined)
    for (const record of rows) {
      if (!tagId && (record.tags ?? []).length === 0) continue
      let label: string
      try {
        label = def.describe(record)
      } catch {
        label = record.id
      }
      found.push({ path, moduleId, record, label })
    }
  }
  return found.sort((a, b) => b.record.updatedAt.localeCompare(a.record.updatedAt))
}

/** All tags, how much each one marks, and rename / colour / delete. */
export function TagsPage() {
  const t = useCoreT()
  const tags = useTags()
  const tagged = useLiveQuery(() => readTagged(null), [])

  const counts = new Map<string, number>()
  for (const item of tagged ?? []) {
    for (const id of item.record.tags ?? []) counts.set(id, (counts.get(id) ?? 0) + 1)
  }

  return (
    <div className="to-settings">
      <h1 className="to-settings__title">{t('tags.title')}</h1>
      <p className="to-muted">{t('tags.body')}</p>

      {tags.length === 0 ? (
        <EmptyState title={t('tags.empty.title')} body={t('tags.empty.body')} />
      ) : (
        <ul className="to-trash">
          {tags.map((tag) => (
            <TagRow key={tag.id} id={tag.id} name={tag.name} color={tag.color} count={counts.get(tag.id) ?? 0} />
          ))}
        </ul>
      )}
    </div>
  )
}

function TagRow({ id, name, color, count }: { id: string; name: string; color: string; count: number }) {
  const t = useCoreT()
  const { deviceId } = useAppState()
  const [draft, setDraft] = useState(name)

  const rename = () => {
    const clean = draft.trim().replace(/^#/, '')
    if (!clean || clean === name) return setDraft(name)
    void updateRecord(TAGS_PATH, id, { name: clean }, deviceId)
  }

  return (
    <li className="to-trash__item">
      <span className="to-tag" data-color={color}>#</span>
      <input
        className="to-field__input to-tagrow__name"
        value={draft}
        aria-label={t('tags.rename', { name })}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={rename}
        onKeyDown={(event) => event.key === 'Enter' && (event.target as HTMLInputElement).blur()}
      />
      <select
        className="to-select"
        value={color}
        aria-label={t('tags.color', { name })}
        onChange={(event) => void updateRecord(TAGS_PATH, id, { color: event.target.value }, deviceId)}
      >
        {ACCENTS.map((accent) => (
          <option key={accent} value={accent}>
            {t(`settings.accent.${accent}`)}
          </option>
        ))}
      </select>
      <Link to={`/tags/${id}`} className="to-button to-button--ghost">
        {t('tags.count', { count })}
        <ChevronRight size={15} />
      </Link>
      <button
        type="button"
        className="to-iconbutton"
        aria-label={t('tags.delete', { name })}
        title={t('tags.delete', { name })}
        onClick={() => void removeRecord(TAGS_PATH, id, deviceId)}
      >
        <Trash2 size={15} />
      </button>
    </li>
  )
}

/** Everything carrying one tag, from every module, newest first. */
export function TagPage() {
  const t = useCoreT()
  const { tagId = '' } = useParams()
  const tags = useTags()
  const tag = tags.find((candidate) => candidate.id === tagId)
  const items = useLiveQuery(() => readTagged(tagId), [tagId])

  return (
    <div className="to-settings">
      <Link to="/tags" className="to-backlink">
        <ArrowLeft size={16} />
        {t('tags.title')}
      </Link>
      <h1 className="to-settings__title">
        {tag ? (
          <span className="to-tag to-tag--large" data-color={tag.color}>
            #{tag.name}
          </span>
        ) : (
          t('tags.unknown')
        )}
      </h1>

      {items === undefined ? null : items.length === 0 ? (
        <EmptyState title={t('tags.none')} />
      ) : (
        <ul className="to-trash">
          {items.map(({ path, moduleId, record, label }) => {
            const mod = getModule(moduleId)
            return (
              <li key={`${path}/${record.id}`}>
                <Link to={`/${moduleId}`} className="to-trash__item to-trash__item--link">
                  <ModuleIcon icon={mod?.icon} label={mod?.name ?? moduleId} size={16} boxed />
                  <span className="to-trash__text">
                    <span className="to-trash__label">{label}</span>
                    <span className="to-muted">{mod?.name ?? moduleId}</span>
                  </span>
                  <ChevronRight size={16} />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
