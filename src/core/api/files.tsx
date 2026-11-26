import { useEffect, useRef, useState, type DragEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Check,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Link2,
  Music2,
  Paperclip,
  Play,
  RotateCcw,
  Trash2,
  Video,
} from 'lucide-react'
import type { StoredFile, StoredLink } from '@core/collections'
import * as repository from '@core/db/repository'
import { getBlob, hashBlob, putBlob } from '@core/files/blobs'
import { translate } from '@core/i18n/catalog'
import { collectionPath, getModule } from '@core/registry/registry'
import { useAppState } from '@core/runtime/app-context'
import { useModuleId } from '@core/runtime/module-context'
import type { Envelope } from './types'

const FILES_PATH = 'core/files'
const LINKS_PATH = 'core/links'
const EMPTY: never[] = []

function useCoreT() {
  const { locale } = useAppState()
  return (key: string, vars?: Record<string, unknown>) => translate(locale, 'core', key, vars)
}

/** Every live file, or only those attached to one record. Newest first. */
export function useFiles(attachedTo?: { path: string; id: string } | null): Envelope<StoredFile>[] {
  const key = attachedTo ? `${attachedTo.path}#${attachedTo.id}` : '*'
  return (
    useLiveQuery(
      async () =>
        (await repository.readAll<StoredFile>(FILES_PATH))
          .filter(
            (row) =>
              !attachedTo ||
              (row.data.attachedTo?.path === attachedTo.path && row.data.attachedTo.id === attachedTo.id),
          )
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      [key],
      EMPTY as Envelope<StoredFile>[],
    ) ?? (EMPTY as Envelope<StoredFile>[])
  )
}

/** Stores the bytes, then the record. Returns the new record ids. */
export function useAddFiles(): (files: Iterable<File>, attachedTo: { path: string; id: string } | null) => Promise<string[]> {
  const { deviceId } = useAppState()
  return async (files, attachedTo) => {
    const ids: string[] = []
    for (const file of files) {
      const hash = await hashBlob(file)
      await putBlob(file, hash)
      ids.push(
        await repository.createRecord<StoredFile>(
          FILES_PATH,
          { name: file.name || 'arquivo', type: file.type, size: file.size, hash, attachedTo },
          deviceId,
        ),
      )
    }
    return ids
  }
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

/** Opens the file in a new tab when the browser can show it, downloads it otherwise. */
async function openFile(file: StoredFile): Promise<boolean> {
  const blob = await getBlob(file.hash)
  if (!blob) return false
  const url = URL.createObjectURL(blob.type ? blob : new Blob([blob], { type: file.type }))
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return true
}

export type FileCategory = 'document' | 'image' | 'audio' | 'video' | 'other'

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'svg']
const AUDIO_EXT = ['mp3', 'm4a', 'aac', 'flac', 'ogg', 'wav', 'opus']
const VIDEO_EXT = ['mp4', 'mkv', 'webm', 'mov', 'avi', 'm4v']
const DOC_EXT = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'md', 'odt', 'ppt', 'pptx', 'ofx']

/** What a file is, by its type and, failing that, its extension. */
export function fileCategory(file: Pick<StoredFile, 'type' | 'name'>): FileCategory {
  const type = file.type.toLowerCase()
  const ext = file.name.toLowerCase().split('.').pop() ?? ''
  if (type.startsWith('image/') || IMAGE_EXT.includes(ext)) return 'image'
  if (type.startsWith('audio/') || AUDIO_EXT.includes(ext)) return 'audio'
  if (type.startsWith('video/') || VIDEO_EXT.includes(ext)) return 'video'
  const office = ['pdf', 'word', 'sheet', 'presentation'].some((word) => type.includes(word))
  if (office || type.startsWith('text/') || DOC_EXT.includes(ext)) return 'document'
  return 'other'
}

/** A temporary address for a stored file's bytes, released when no longer shown. */
export function useBlobUrl(hash: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!hash) return
    let created: string | null = null
    let live = true
    void getBlob(hash).then((blob) => {
      if (blob && live) setUrl((created = URL.createObjectURL(blob)))
    })
    return () => {
      live = false
      if (created) URL.revokeObjectURL(created)
      setUrl(null)
    }
  }, [hash])
  return url
}

const CATEGORY_ICON = {
  image: <ImageIcon size={16} />,
  audio: <Music2 size={16} />,
  video: <Video size={16} />,
  document: <FileText size={16} />,
  other: <FileText size={16} />,
}

function Thumbnail({ file }: { file: StoredFile }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!file.type.startsWith('image/')) return
    let created: string | null = null
    void getBlob(file.hash).then((blob) => {
      if (blob) setUrl((created = URL.createObjectURL(blob)))
    })
    return () => {
      if (created) URL.revokeObjectURL(created)
    }
  }, [file.hash, file.type])

  if (url) return <img className="to-file__thumb" src={url} alt="" />
  return (
    <span className="to-file__thumb to-file__thumb--icon" aria-hidden>
      {CATEGORY_ICON[fileCategory(file)]}
    </span>
  )
}

/** The rows of a file list, with open and remove. */
export function FileRows({
  files,
  showOrigin,
  onPlay,
}: {
  files: Envelope<StoredFile>[]
  showOrigin?: boolean
  /** When given, audio and video play here instead of downloading. */
  onPlay?: (file: Envelope<StoredFile>) => void
}) {
  const t = useCoreT()
  const { deviceId } = useAppState()
  const [missing, setMissing] = useState<string | null>(null)
  return (
    <ul className="to-list">
      {files.map((row) => {
        const from = row.data.attachedTo
        const origin = showOrigin
          ? from
            ? (getModule(from.path.split('/')[0])?.name ?? from.path)
            : t('files.loose')
          : null
        const playable = Boolean(onPlay) && ['audio', 'video'].includes(fileCategory(row.data))
        const download = () => void openFile(row.data).then((ok) => setMissing(ok ? null : row.id))
        return (
          <li key={row.id} className="to-list__item to-file">
            <Thumbnail file={row.data} />
            <button
              type="button"
              className="to-list__main to-rowbutton"
              onClick={() => (playable ? onPlay!(row) : download())}
            >
              <span className="to-list__title">{row.data.name}</span>
              <span className="to-list__meta">
                <span>{formatSize(row.data.size)}</span>
                {origin && <span>{origin}</span>}
                {missing === row.id && <span className="to-negative">{t('files.missing')}</span>}
              </span>
            </button>
            {playable && (
              <button
                type="button"
                className="to-iconbutton to-iconbutton--small"
                aria-label={t('files.play')}
                title={t('files.play')}
                onClick={() => onPlay!(row)}
              >
                <Play size={14} />
              </button>
            )}
            <button
              type="button"
              className="to-iconbutton to-iconbutton--small"
              aria-label={t('files.download')}
              title={t('files.download')}
              onClick={download}
            >
              <Download size={14} />
            </button>
            <button
              type="button"
              className="to-iconbutton to-iconbutton--small"
              aria-label={t('files.remove')}
              title={t('files.remove')}
              onClick={() => void repository.removeRecord(FILES_PATH, row.id, deviceId)}
            >
              <Trash2 size={14} />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** A button and a drop zone that add files, attached to a record or loose. */
export function FileDrop({
  attachedTo,
  compact,
}: {
  attachedTo: { path: string; id: string } | null
  compact?: boolean
}) {
  const t = useCoreT()
  const add = useAddFiles()
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)

  const take = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setBusy(true)
    try {
      await add(Array.from(files), attachedTo)
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }
  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setOver(false)
    void take(event.dataTransfer.files)
  }

  return (
    <div
      className={`to-filedrop${compact ? ' to-filedrop--compact' : ''}${over ? ' is-over' : ''}`}
      onDragOver={(event) => {
        event.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <input ref={input} type="file" multiple hidden onChange={(event) => void take(event.target.files)} />
      <button type="button" className="to-button" disabled={busy} onClick={() => input.current?.click()}>
        <Paperclip size={14} />
        {busy ? t('files.adding') : t(compact ? 'files.attach' : 'files.add')}
      </button>
      {!compact && <span className="to-muted">{t('files.drop')}</span>}
    </div>
  )
}

/**
 * Attachments of one record of the calling module: `collection` is the
 * module's own collection name, as in `useRecords`.
 */
export function Attachments({ collection, id }: { collection: string; id: string }) {
  const moduleId = useModuleId()
  const attachedTo = { path: collectionPath(moduleId, collection), id }
  const files = useFiles(attachedTo)
  const links = useLinks(attachedTo)
  return (
    <div className="to-attachments">
      {files.length > 0 && <FileRows files={files} />}
      {links.length > 0 && <LinkRows links={links} />}
      <div className="to-toolbar">
        <FileDrop attachedTo={attachedTo} compact />
        <LinkAdd attachedTo={attachedTo} compact />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Links: kept in Arquivos, attachable to anything
 * ------------------------------------------------------------------ */

/** Accepts "exemplo.com/x" as well as a full address; anything else stays as typed. */
export function normalizeUrl(text: string): string {
  const trimmed = text.trim()
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed
  if (/^[^\s/]+\.[^\s/]+/.test(trimmed)) return `https://${trimmed}`
  return trimmed
}

/** "https://www.site.com/a/b" -> "site.com", for the line under the title. */
export function urlHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Splits "título https://..." or "https://... título" into its two parts. */
export function parseLink(text: string): { url: string; title: string } {
  const words = text.trim().split(/\s+/)
  const at = words.findIndex((word) => /^(https?:\/\/|www\.)|^[^\s/]+\.[a-z]{2,}(\/|$)/i.test(word))
  if (at === -1) return { url: normalizeUrl(text), title: '' }
  const url = normalizeUrl(words[at])
  const title = [...words.slice(0, at), ...words.slice(at + 1)].join(' ')
  return { url, title }
}

export function useLinks(attachedTo?: { path: string; id: string } | null): Envelope<StoredLink>[] {
  const key = attachedTo ? `${attachedTo.path}#${attachedTo.id}` : '*'
  return (
    useLiveQuery(
      async () =>
        (await repository.readAll<StoredLink>(LINKS_PATH))
          .filter(
            (row) =>
              !attachedTo ||
              (row.data.attachedTo?.path === attachedTo.path && row.data.attachedTo.id === attachedTo.id),
          )
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      [key],
      EMPTY as Envelope<StoredLink>[],
    ) ?? (EMPTY as Envelope<StoredLink>[])
  )
}

export function LinkRows({ links, showOrigin }: { links: Envelope<StoredLink>[]; showOrigin?: boolean }) {
  const t = useCoreT()
  const { deviceId } = useAppState()
  return (
    <ul className="to-list">
      {links.map((row) => {
        const { url, title, read, attachedTo } = row.data
        return (
          <li key={row.id} className={`to-list__item to-file${read ? ' is-done' : ''}`}>
            <span className="to-file__thumb to-file__thumb--icon" aria-hidden>
              <Link2 size={16} />
            </span>
            <span className="to-list__main">
              <a className="to-list__title" href={url} target="_blank" rel="noopener noreferrer">
                {title || urlHost(url)} <ExternalLink size={12} aria-hidden />
              </a>
              <span className="to-list__meta">
                <span>{urlHost(url)}</span>
                {showOrigin && (
                  <span>
                    {attachedTo ? (getModule(attachedTo.path.split('/')[0])?.name ?? attachedTo.path) : t('files.loose')}
                  </span>
                )}
              </span>
            </span>
            <button
              type="button"
              className="to-iconbutton to-iconbutton--small"
              aria-label={t(read ? 'links.unread' : 'links.read')}
              title={t(read ? 'links.unread' : 'links.read')}
              onClick={() => void repository.updateRecord<StoredLink>(LINKS_PATH, row.id, { read: !read }, deviceId)}
            >
              {read ? <RotateCcw size={14} /> : <Check size={14} />}
            </button>
            <button
              type="button"
              className="to-iconbutton to-iconbutton--small"
              aria-label={t('files.remove')}
              title={t('files.remove')}
              onClick={() => void repository.removeRecord(LINKS_PATH, row.id, deviceId)}
            >
              <Trash2 size={14} />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** A field that saves a link, loose or attached. */
export function LinkAdd({
  attachedTo,
  compact,
}: {
  attachedTo: { path: string; id: string } | null
  compact?: boolean
}) {
  const t = useCoreT()
  const { deviceId } = useAppState()
  const [text, setText] = useState('')
  const [open, setOpen] = useState(!compact)
  const save = async () => {
    if (!text.trim()) return
    const { url, title } = parseLink(text)
    await repository.createRecord<StoredLink>(LINKS_PATH, { url, title, note: '', read: false, attachedTo }, deviceId)
    setText('')
    if (compact) setOpen(false)
  }
  if (!open) {
    return (
      <button type="button" className="to-button" onClick={() => setOpen(true)}>
        <Link2 size={14} />
        {t('links.attach')}
      </button>
    )
  }
  return (
    <form
      className="to-linkadd"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <input
        autoFocus={compact}
        className="to-field__input"
        value={text}
        placeholder={t('links.placeholder')}
        aria-label={t('links.placeholder')}
        onChange={(event) => setText(event.target.value)}
      />
      <button type="submit" className="to-button" disabled={!text.trim()}>
        <Link2 size={14} />
        {t('links.save')}
      </button>
    </form>
  )
}
