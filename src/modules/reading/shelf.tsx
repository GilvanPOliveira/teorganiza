import { useEffect, useState } from 'react'
import { Check, Play, Plus, Star, Trash2 } from 'lucide-react'
import {
  Badge,
  EmptyState,
  QuickAdd,
  Segmented,
  TagList,
  useCollection,
  useOpenHref,
  useRecords,
  useT,
  type Envelope,
} from '@core/api'
import type { Media, Music, ShelfStatus } from './schema'

const STATES: ShelfStatus[] = ['doing', 'want', 'done', 'own']

function Stars({ value, onChange }: { value: number | null; onChange: (n: number | null) => void }) {
  const t = useT()
  return (
    <span className="to-stars" role="radiogroup" aria-label="Nota">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={t('item.rate', { n })}
          className={`to-stars__star${value !== null && n <= value ? ' is-on' : ''}`}
          onClick={() => onChange(value === n ? null : n)}
        >
          <Star size={14} />
        </button>
      ))}
    </span>
  )
}

/** Moves between the four places: start, finish, queue. */
function StateButtons({ status, doing, onChange }: { status: ShelfStatus; doing: string; onChange: (s: ShelfStatus) => void }) {
  const t = useT()
  return (
    <span className="to-toolbar">
      {(status === 'want' || status === 'own') && (
        <button type="button" className="to-button" onClick={() => onChange('doing')}>
          <Play size={14} />
          {doing}
        </button>
      )}
      {status === 'doing' && (
        <button type="button" className="to-button" onClick={() => onChange('done')}>
          <Check size={14} />
          {t('item.finish')}
        </button>
      )}
      {status === 'done' && (
        <button type="button" className="to-button" onClick={() => onChange('want')}>
          <Plus size={14} />
          {t('item.queue')}
        </button>
      )}
    </span>
  )
}

function useStateFilter(labelDoing: string) {
  const t = useT()
  const [state, setState] = useState<ShelfStatus>('doing')
  const control = (counts: Record<ShelfStatus, number>) => (
    <Segmented<ShelfStatus>
      label={t('shelf.state')}
      value={state}
      onChange={setState}
      options={STATES.map((value) => ({
        value,
        label: `${value === 'doing' ? labelDoing : t(`status.${value}`)} (${counts[value]})`,
      }))}
    />
  )
  return { state, setState, control }
}

function count<T extends { status: ShelfStatus }>(rows: Envelope<T>[]): Record<ShelfStatus, number> {
  const result = { want: 0, doing: 0, done: 0, own: 0 }
  for (const row of rows) result[row.data.status]++
  return result
}

/* ------------------------------------------------------------------ *
 * Filmes e séries
 * ------------------------------------------------------------------ */

function MediaTile({ item }: { item: Envelope<Media> }) {
  const t = useT()
  const { update, remove } = useCollection<Media>('media')
  const { title, kind, status, rating, season, episode } = item.data
  return (
    <article className="to-tile">
      <span className="to-tile__row">
        <h3 className="to-tile__title">{title}</h3>
        <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('item.remove')} onClick={() => void remove(item.id)}>
          <Trash2 size={14} />
        </button>
      </span>
      <span className="to-list__meta">
        <Badge>{t(`media.${kind}`)}</Badge>
        {kind === 'series' && season !== null && <span>{t('media.episode', { season, episode: episode ?? 0 })}</span>}
        <TagList ids={item.tags} />
      </span>
      {kind === 'series' && status === 'doing' && (
        <span className="to-toolbar">
          <button type="button" className="to-button" onClick={() => void update(item.id, { season: season ?? 1, episode: (episode ?? 0) + 1 })}>
            {t('media.nextEpisode')}
          </button>
          <button type="button" className="to-button" onClick={() => void update(item.id, { season: (season ?? 1) + 1, episode: 0 })}>
            {t('media.nextSeason')}
          </button>
        </span>
      )}
      <span className="to-tile__row">
        <StateButtons
          status={status}
          doing={t('item.start')}
          onChange={(next) => void update(item.id, next === 'doing' && kind === 'series' && season === null ? { status: next, season: 1, episode: 0 } : { status: next })}
        />
        {status === 'done' && <Stars value={rating} onChange={(n) => void update(item.id, { rating: n })} />}
      </span>
    </article>
  )
}

export function MediaScreen() {
  const t = useT()
  const items = useRecords<Media>('media')
  const { create } = useCollection<Media>('media')
  const [kind, setKind] = useState<Media['kind']>('movie')
  const { state, setState, control } = useStateFilter(t('status.doing.media'))
  const shown = items.filter((item) => item.data.status === state).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  return (
    <div className="to-stack">
      <QuickAdd
        placeholder={t('media.placeholder')}
        onAdd={async (title) => {
          await create({ title, kind, status: state, rating: null, season: kind === 'series' && state === 'doing' ? 1 : null, episode: kind === 'series' && state === 'doing' ? 0 : null, note: '' })
          setState(state)
        }}
      >
        <select className="to-field__input" value={kind} aria-label={t('media.kind')} onChange={(e) => setKind(e.target.value as Media['kind'])}>
          <option value="movie">{t('media.movie')}</option>
          <option value="series">{t('media.series')}</option>
        </select>
      </QuickAdd>
      {control(count(items))}
      {shown.length === 0 ? (
        <EmptyState title={t('media.empty')} body={t('media.body')} />
      ) : (
        <div className="to-cards">
          {shown.map((item) => (
            <MediaTile key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Música
 * ------------------------------------------------------------------ */

const MUSIC_KINDS: { value: Music['kind']; key: string }[] = [
  { value: 'album', key: 'music.album' },
  { value: 'artist', key: 'music.artistKind' },
  { value: 'song', key: 'music.song' },
  { value: 'playlist', key: 'music.playlist' },
]

function MusicTile({ item }: { item: Envelope<Music> }) {
  const t = useT()
  const { update, remove } = useCollection<Music>('music')
  const { title, artist, kind, status, rating } = item.data
  return (
    <article className="to-tile">
      <span className="to-tile__row">
        <h3 className="to-tile__title">{title}</h3>
        <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('item.remove')} onClick={() => void remove(item.id)}>
          <Trash2 size={14} />
        </button>
      </span>
      <span className="to-list__meta">
        <Badge>{t(MUSIC_KINDS.find((k) => k.value === kind)!.key)}</Badge>
        {artist && <span>{artist}</span>}
        <TagList ids={item.tags} />
      </span>
      <span className="to-tile__row">
        <StateButtons status={status} doing={t('item.start')} onChange={(next) => void update(item.id, { status: next })} />
        {status === 'done' && <Stars value={rating} onChange={(n) => void update(item.id, { rating: n })} />}
      </span>
    </article>
  )
}

export function MusicScreen() {
  const t = useT()
  const items = useRecords<Music>('music')
  const { create } = useCollection<Music>('music')
  const [kind, setKind] = useState<Music['kind']>('album')
  const [artist, setArtist] = useState('')
  const { state, control } = useStateFilter(t('status.doing.music'))
  const shown = items.filter((item) => item.data.status === state).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  return (
    <div className="to-stack">
      <QuickAdd
        placeholder={t('music.placeholder')}
        onAdd={async (title) => {
          await create({ title, artist: artist.trim(), kind, status: state, rating: null, note: '' })
          setArtist('')
        }}
      >
        <input className="to-field__input" value={artist} placeholder={t('music.artist')} aria-label={t('music.artist')} onChange={(e) => setArtist(e.target.value)} />
        <select className="to-field__input" value={kind} aria-label={t('music.kind')} onChange={(e) => setKind(e.target.value as Music['kind'])}>
          {MUSIC_KINDS.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.key)}
            </option>
          ))}
        </select>
      </QuickAdd>
      {control(count(items))}
      {shown.length === 0 ? (
        <EmptyState title={t('music.empty')} body={t('music.body')} />
      ) : (
        <div className="to-cards">
          {shown.map((item) => (
            <MusicTile key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

/** Saved links now live in Arquivos, where they can be attached to anything. */
export function LinksRedirect() {
  const open = useOpenHref()
  useEffect(() => {
    open('/files?tipo=links')
  }, [open])
  return null
}
