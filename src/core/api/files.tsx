import { useEffect, useRef, useState, type DragEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, FileText, Image as ImageIcon, Paperclip, Trash2 } from 'lucide-react'
import type { StoredFile } from '@core/collections'
import * as repository from '@core/db/repository'
import { getBlob, hashBlob, putBlob } from '@core/files/blobs'
import { translate } from '@core/i18n/catalog'
import { collectionPath, getModule } from '@core/registry/registry'
import { useAppState } from '@core/runtime/app-context'
import { useModuleId } from '@core/runtime/module-context'
import type { Envelope } from './types'

const FILES_PATH = 'core/files'
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
      {file.type.startsWith('image/') ? <ImageIcon size={16} /> : <FileText size={16} />}
    </span>
  )
}

/** The rows of a file list, with open and remove. */
export function FileRows({ files, showOrigin }: { files: Envelope<StoredFile>[]; showOrigin?: boolean }) {
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
        return (
          <li key={row.id} className="to-list__item to-file">
            <Thumbnail file={row.data} />
            <button
              type="button"
              className="to-list__main to-rowbutton"
              onClick={() => void openFile(row.data).then((ok) => setMissing(ok ? null : row.id))}
            >
              <span className="to-list__title">{row.data.name}</span>
              <span className="to-list__meta">
                <span>{formatSize(row.data.size)}</span>
                {origin && <span>{origin}</span>}
                {missing === row.id && <span className="to-negative">{t('files.missing')}</span>}
              </span>
            </button>
            <button
              type="button"
              className="to-iconbutton to-iconbutton--small"
              aria-label={t('files.download')}
              title={t('files.download')}
              onClick={() => void openFile(row.data).then((ok) => setMissing(ok ? null : row.id))}
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
  return (
    <div className="to-attachments">
      {files.length > 0 && <FileRows files={files} />}
      <FileDrop attachedTo={attachedTo} compact />
    </div>
  )
}
