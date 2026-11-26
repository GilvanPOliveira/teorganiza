import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Pause, Play, Search, SkipBack, SkipForward, X } from 'lucide-react'
import {
  EmptyState,
  FileDrop,
  FileRows,
  fileCategory,
  formatSize,
  LinkAdd,
  LinkRows,
  Segmented,
  useBlobUrl,
  useFiles,
  useLinks,
  useT,
  type Envelope,
  type StoredFile,
} from '@core/api'

type Filter = 'all' | 'document' | 'exam' | 'image' | 'audio' | 'video' | 'links'
const FILTERS: Filter[] = ['all', 'document', 'exam', 'image', 'audio', 'video', 'links']

function matches(file: StoredFile, filter: Filter): boolean {
  if (filter === 'all') return true
  if (filter === 'exam') return file.attachedTo?.path === 'health/exams'
  return fileCategory(file) === filter
}

/**
 * Plays audio and video kept in Arquivos. Audio goes through the list it
 * was started from: next, previous, and on to the next track at the end.
 */
function Player({
  queue,
  index,
  onIndex,
  onClose,
}: {
  queue: Envelope<StoredFile>[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
}) {
  const t = useT()
  const current = queue[index]
  const url = useBlobUrl(current?.data.hash ?? null)
  const [playing, setPlaying] = useState(true)
  if (!current) return null
  const video = fileCategory(current.data) === 'video'
  const media = () => document.querySelector<HTMLMediaElement>('.to-player__media')

  return (
    <section className="to-player" aria-label={t('player.label')}>
      <header className="to-player__bar">
        <strong className="to-player__title">{current.data.name}</strong>
        <span className="to-muted">
          {index + 1}/{queue.length}
        </span>
        <span className="to-toolbar">
          <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('player.previous')} disabled={index === 0} onClick={() => onIndex(index - 1)}>
            <SkipBack size={15} />
          </button>
          <button
            type="button"
            className="to-iconbutton to-iconbutton--small"
            aria-label={playing ? t('player.pause') : t('player.play')}
            onClick={() => {
              const el = media()
              if (!el) return
              if (el.paused) void el.play()
              else el.pause()
            }}
          >
            {playing ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('player.next')} disabled={index >= queue.length - 1} onClick={() => onIndex(index + 1)}>
            <SkipForward size={15} />
          </button>
          <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('player.close')} onClick={onClose}>
            <X size={15} />
          </button>
        </span>
      </header>
      {!url ? (
        <p className="to-muted">{t('player.missing')}</p>
      ) : video ? (
        <video
          key={url}
          className="to-player__media to-player__video"
          src={url}
          controls
          autoPlay
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => index < queue.length - 1 && onIndex(index + 1)}
        />
      ) : (
        <audio
          key={url}
          className="to-player__media"
          src={url}
          controls
          autoPlay
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => index < queue.length - 1 && onIndex(index + 1)}
        />
      )}
    </section>
  )
}

export function FilesScreen() {
  const t = useT()
  const files = useFiles()
  const links = useLinks()
  const [params, setParams] = useSearchParams()
  const filter = FILTERS.find((value) => value === params.get('tipo')) ?? 'all'
  const [query, setQuery] = useState('')
  const [linkState, setLinkState] = useState<'later' | 'done'>('later')
  const [playing, setPlaying] = useState<{ queue: Envelope<StoredFile>[]; index: number } | null>(null)

  const words = query.trim().toLocaleLowerCase()
  const shown = useMemo(
    () =>
      files.filter(
        (file) => matches(file.data, filter) && (!words || file.data.name.toLocaleLowerCase().includes(words)),
      ),
    [files, filter, words],
  )
  const shownLinks = links.filter(
    (link) =>
      link.data.read === (linkState === 'done') &&
      (!words || `${link.data.title} ${link.data.url}`.toLocaleLowerCase().includes(words)),
  )
  const counts = Object.fromEntries(
    FILTERS.map((value) => [value, value === 'links' ? links.length : files.filter((f) => matches(f.data, value)).length]),
  ) as Record<Filter, number>
  const total = files.reduce((sum, file) => sum + file.data.size, 0)

  const play = (file: Envelope<StoredFile>) => {
    // The queue is what the list shows of the same kind, from the file clicked.
    const kind = fileCategory(file.data)
    const queue = shown.filter((f) => fileCategory(f.data) === kind)
    setPlaying({ queue, index: Math.max(0, queue.findIndex((f) => f.id === file.id)) })
  }

  return (
    <div className="to-stack">
      {playing && (
        <Player
          queue={playing.queue}
          index={playing.index}
          onIndex={(index) => setPlaying({ ...playing, index })}
          onClose={() => setPlaying(null)}
        />
      )}

      {filter === 'links' ? <LinkAdd attachedTo={null} /> : <FileDrop attachedTo={null} />}

      <div className="to-toolbar">
        {FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            className={`to-chip${filter === value ? ' is-active' : ''}`}
            onClick={() => setParams(value === 'all' ? {} : { tipo: value }, { replace: true })}
          >
            {t(`filter.${value}`)} ({counts[value]})
          </button>
        ))}
      </div>

      {(files.length > 5 || links.length > 5) && (
        <label className="to-search to-search--wide">
          <Search size={15} aria-hidden />
          <input className="to-search__input" value={query} placeholder={t('search')} aria-label={t('search')} onChange={(e) => setQuery(e.target.value)} />
        </label>
      )}

      {filter === 'links' ? (
        <>
          <Segmented<'later' | 'done'>
            label={t('links.state')}
            value={linkState}
            onChange={setLinkState}
            options={[
              { value: 'later', label: t('links.later', { count: links.filter((l) => !l.data.read).length }) },
              { value: 'done', label: t('links.done') },
            ]}
          />
          {shownLinks.length === 0 ? (
            <EmptyState title={t('links.empty')} body={t('links.body')} />
          ) : (
            <LinkRows links={shownLinks} showOrigin />
          )}
        </>
      ) : shown.length === 0 ? (
        <EmptyState title={t('empty.title')} body={t(`empty.${filter}`)} />
      ) : (
        <>
          <p className="to-muted">{t('summary', { count: files.length, size: formatSize(total) })}</p>
          <FileRows files={shown} showOrigin onPlay={play} />
        </>
      )}
    </div>
  )
}
