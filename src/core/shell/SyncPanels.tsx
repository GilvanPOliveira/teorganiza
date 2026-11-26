import { useEffect, useState, type ReactNode } from 'react'
import { Cloud, FolderOpen } from 'lucide-react'
import { useFormat } from '@core/api/hooks'
import { Button, Card } from '@core/api/ui'
import { readAll } from '@core/db/repository'
import { translate } from '@core/i18n/catalog'
import { useAppState } from '@core/runtime/app-context'
import { getSyncController, useSyncState } from '@core/runtime/sync'
import type { ConflictChoice } from '@core/sync/merge'
import type { Conflict } from '@core/sync/types'

function useCoreT() {
  const { locale } = useAppState()
  return (key: string, vars?: Record<string, unknown>) => translate(locale, 'core', key, vars)
}

/** The "data destination" card in settings. */
export function StorageSettings() {
  const t = useCoreT()
  const sync = useSyncState()
  const controller = getSyncController()
  const busy = sync.phase === 'syncing'

  if (sync.kind === null) {
    return (
      <Card title={t('settings.storage')}>
        {sync.persisted === false && <p className="to-muted">{t('storage.notPersisted')}</p>}
        {sync.error && <p className="to-negative">{sync.error}</p>}

        <div className="to-destinations">
          <section className="to-destination">
            <span className="to-iconbox">
              <FolderOpen size={18} />
            </span>
            <div className="to-destination__text">
              <strong>{t('storage.folder')}</strong>
              <span className="to-muted">
                {sync.folderAvailable ? t('storage.folder.note') : t('storage.folder.unavailable')}
              </span>
            </div>
            {sync.folderAvailable && (
              <Button variant="primary" onClick={() => void controller.connectFolder()}>
                {t('storage.folder.choose')}
              </Button>
            )}
          </section>

          <section className="to-destination">
            <span className="to-iconbox">
              <Cloud size={18} />
            </span>
            <div className="to-destination__text">
              <strong>{t('storage.drive')}</strong>
              <span className="to-muted">
                {sync.driveAvailable ? t('storage.drive.scopeNote') : t('storage.drive.unavailable')}
              </span>
            </div>
            {sync.driveAvailable && (
              <Button onClick={() => void controller.connectDrive()}>{t('storage.drive.connect')}</Button>
            )}
          </section>
        </div>
      </Card>
    )
  }

  const folder = sync.kind === 'disk-web'
  const needsAuth = sync.phase === 'needs-auth'

  return (
    <Card title={t('settings.storage')}>
      <p>
        {needsAuth
          ? t(folder ? 'storage.folder.needsAccess' : 'sync.status.needsAuth')
          : folder
            ? t('storage.folder.connected', { name: sync.destinationLabel ?? '' })
            : t('storage.drive.connected')}
      </p>
      {sync.error && <p className="to-negative">{sync.error}</p>}
      <div className="to-toolbar">
        {needsAuth ? (
          <Button variant="primary" onClick={() => void controller.connect(sync.kind!)}>
            {t(folder ? 'storage.folder.allow' : 'storage.reconnect')}
          </Button>
        ) : (
          <>
            <Button variant="primary" disabled={busy} onClick={() => void controller.sync()}>
              {t('sync.now')}
            </Button>
            {!folder && <Button onClick={() => controller.signOut()}>{t('storage.signOut')}</Button>}
          </>
        )}
      </div>
      <div className="to-toolbar">
        <Button variant="ghost" onClick={() => void controller.disconnect()}>
          {t('storage.disconnect')}
        </Button>
        <span className="to-muted">
          {t(folder ? 'storage.folder.disconnectNote' : 'storage.disconnect.note')}
        </span>
      </div>
      {!folder && !needsAuth && (
        <div className="to-toolbar">
          <Button variant="danger" onClick={() => void controller.revoke()}>
            {t('storage.revoke')}
          </Button>
          <span className="to-muted">{t('storage.revoke.note')}</span>
        </div>
      )}
    </Card>
  )
}

/** One status line for the shell's status bar. */
export function SyncStatus() {
  const t = useCoreT()
  const format = useFormat()
  const sync = useSyncState()
  const controller = getSyncController()

  let message: ReactNode
  switch (sync.phase) {
    case 'syncing':
      message = t('sync.status.syncing')
      break
    case 'needs-auth':
      message = (
        <button type="button" className="to-linklike" onClick={() => void controller.connect(sync.kind!)}>
          {t(sync.kind === 'disk-web' ? 'storage.folder.needsAccess' : 'sync.status.needsAuth')}
        </button>
      )
      break
    case 'error':
      message = t('sync.status.error', { message: sync.error })
      break
    case 'conflicts':
      message = t('sync.status.conflicts', { count: sync.conflicts.length })
      break
    default:
      message = sync.lastSyncAt ? t('sync.lastSync', { when: format.relative(sync.lastSyncAt) }) : t('storage.never')
  }

  return (
    <>
      <span>{message}</span>
      <span>{t('sync.pending', { count: sync.pendingCount })}</span>
    </>
  )
}

/** The questions only the user can answer, rendered above everything. */
export function SyncDialogs() {
  const sync = useSyncState()
  if (sync.phase === 'first-sync') return <FirstSyncDialog />
  if (sync.phase === 'conflicts' && sync.conflicts.length > 0) return <ConflictDialog conflicts={sync.conflicts} />
  if (sync.phase === 'lock-held' && sync.lockHolder) return <LockDialog />
  return null
}

function Dialog({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="to-dialog__backdrop">
      <div className="to-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <h2 className="to-dialog__title">{title}</h2>
        {children}
      </div>
    </div>
  )
}

function FirstSyncDialog() {
  const t = useCoreT()
  const controller = getSyncController()
  const options = ['import', 'send', 'merge'] as const
  return (
    <Dialog title={t('sync.first.title')}>
      <p>{t('sync.first.body')}</p>
      <div className="to-stack">
        {options.map((choice) => (
          <div key={choice} className="to-dialog__option">
            <Button variant={choice === 'merge' ? 'primary' : 'secondary'} onClick={() => void controller.chooseFirstSync(choice)}>
              {t(`sync.first.${choice}`)}
            </Button>
            <span className="to-muted">{t(`sync.first.${choice}.note`)}</span>
          </div>
        ))}
      </div>
    </Dialog>
  )
}

function ConflictDialog({ conflicts }: { conflicts: Conflict[] }) {
  const t = useCoreT()
  const format = useFormat()
  const controller = getSyncController()
  const nicknames = useDeviceNicknames()
  const [choices, setChoices] = useState<Map<string, ConflictChoice>>(new Map())

  const choose = (id: string, choice: ConflictChoice) => setChoices((prev) => new Map(prev).set(id, choice))
  const chooseAll = (choice: ConflictChoice) => setChoices(new Map(conflicts.map((c) => [c.id, choice])))
  const complete = conflicts.every((c) => choices.has(c.id))

  const side = (conflict: Conflict, which: 'local' | 'remote') => {
    const record = conflict[which]
    const label = which === 'local' ? conflict.localLabel : conflict.remoteLabel
    return (
      <label className="to-dialog__side">
        <input
          type="radio"
          name={conflict.id}
          checked={choices.get(conflict.id) === (which === 'local' ? 'keep-local' : 'take-remote')}
          onChange={() => choose(conflict.id, which === 'local' ? 'keep-local' : 'take-remote')}
        />
        <span>
          <strong>{t(which === 'local' ? 'sync.conflicts.here' : 'sync.conflicts.there')}</strong>
          <span className="to-dialog__label">
            {label} {record.deletedAt && t('sync.conflicts.deleted')}
          </span>
          <span className="to-muted">
            {nicknames.get(record.deviceId) ?? record.deviceId.slice(0, 8)} · {format.dateTime(record.updatedAt)}
          </span>
        </span>
      </label>
    )
  }

  return (
    <Dialog title={t('sync.conflicts.title')}>
      <p>{t('sync.conflicts.body')}</p>
      <div className="to-toolbar">
        <Button variant="ghost" onClick={() => chooseAll('keep-local')}>
          {t('sync.conflicts.allLocal')}
        </Button>
        <Button variant="ghost" onClick={() => chooseAll('take-remote')}>
          {t('sync.conflicts.allRemote')}
        </Button>
      </div>
      <ul className="to-dialog__list">
        {conflicts.map((conflict) => (
          <li key={conflict.id} className="to-dialog__conflict">
            {side(conflict, 'local')}
            {side(conflict, 'remote')}
          </li>
        ))}
      </ul>
      <Button variant="primary" disabled={!complete} onClick={() => void controller.resolveConflicts(choices)}>
        {t('sync.conflicts.apply')}
      </Button>
    </Dialog>
  )
}

function LockDialog() {
  const t = useCoreT()
  const sync = useSyncState()
  const controller = getSyncController()
  const holder = sync.lockHolder!
  // Measured once, when the question is asked.
  const [minutes] = useState(() => Math.max(0, Math.round((Date.now() - Date.parse(holder.since)) / 60000)))
  return (
    <Dialog title={t('sync.lock.title')}>
      <p>{t('sync.lock.body', { device: holder.by.nickname, minutes })}</p>
      <div className="to-toolbar">
        <Button variant="primary" onClick={() => void controller.takeOver()}>
          {t('sync.lock.takeOver')}
        </Button>
        <Button onClick={() => void controller.ignoreLease()}>{t('sync.lock.ignore')}</Button>
      </div>
    </Dialog>
  )
}

function useDeviceNicknames(): Map<string, string> {
  const [names, setNames] = useState(new Map<string, string>())
  useEffect(() => {
    let live = true
    void readAll<{ deviceId: string; nickname: string }>('core/devices').then((rows) => {
      if (live) setNames(new Map(rows.map((r) => [r.data.deviceId, r.data.nickname])))
    })
    return () => {
      live = false
    }
  }, [])
  return names
}
