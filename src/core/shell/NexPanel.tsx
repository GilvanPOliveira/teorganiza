import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Bot, Send, X } from 'lucide-react'
import { Button } from '@core/api/ui'
import { useAppState } from '@core/runtime/app-context'
import { askNex, buildSystemPrompt, nexErrorMessage, type NexAction, type NexMessage } from '@core/nex/agent'
import { NEX_KEY_EVENT, readNexKey, saveNexKey } from '@core/nex/key'
import { useCoreT } from './useShell'

interface Bubble {
  role: 'user' | 'nex'
  text: string
  actions?: NexAction[]
  error?: boolean
}

export function useNexKey(): string {
  const [key, setKey] = useState(readNexKey)
  useEffect(() => {
    const refresh = () => setKey(readNexKey())
    window.addEventListener(NEX_KEY_EVENT, refresh)
    return () => window.removeEventListener(NEX_KEY_EVENT, refresh)
  }, [])
  return key
}

/** Where the key is typed, here and in settings. */
export function NexKeyForm({ onSaved }: { onSaved?: () => void }) {
  const t = useCoreT()
  const [draft, setDraft] = useState('')
  return (
    <form
      className="to-toolbar"
      onSubmit={(event) => {
        event.preventDefault()
        saveNexKey(draft)
        setDraft('')
        onSaved?.()
      }}
    >
      <input
        className="to-field__input"
        type="password"
        autoComplete="off"
        value={draft}
        placeholder="sk-ant-…"
        aria-label={t('nex.key')}
        onChange={(event) => setDraft(event.target.value)}
      />
      <Button type="submit" variant="primary" disabled={!draft.trim()}>
        {t('nex.key.save')}
      </Button>
    </form>
  )
}

/**
 * The conversation with Nex. It opens from the palette, from the review and
 * from settings, and closes with Esc. A conversation lives until the panel
 * closes; nothing of it is stored.
 */
export function NexPanel({ initialPrompt, onClose }: { initialPrompt?: string; onClose: () => void }) {
  const t = useCoreT()
  const { deviceId } = useAppState()
  const apiKey = useNexKey()
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const history = useRef<NexMessage[]>([])
  const system = useRef<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const sentInitial = useRef(false)

  const send = async (text: string) => {
    const question = text.trim()
    if (!question || busy || !apiKey) return
    setDraft('')
    setBusy(true)
    setBubbles((prev) => [...prev, { role: 'user', text: question }])
    try {
      system.current ??= await buildSystemPrompt()
      const turn = await askNex({
        apiKey,
        system: system.current,
        messages: [...history.current, { role: 'user', content: question }],
        deviceId,
      })
      history.current = turn.messages
      setBubbles((prev) => [...prev, { role: 'nex', text: turn.text || t('nex.done'), actions: turn.actions }])
    } catch (error) {
      setBubbles((prev) => [...prev, { role: 'nex', text: nexErrorMessage(error), error: true }])
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (initialPrompt && apiKey && !sentInitial.current) {
      sentInitial.current = true
      void send(initialPrompt)
    }
    // Sends once, as soon as there is a key to send with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt, apiKey])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [bubbles, busy])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    void send(draft)
  }

  return (
    <div className="to-palette__backdrop" onMouseDown={onClose}>
      <section
        className="to-palette to-nex"
        role="dialog"
        aria-modal="true"
        aria-label={t('nex.title')}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="to-nex__header">
          <Bot size={18} aria-hidden />
          <strong>{t('nex.title')}</strong>
          <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('nex.close')} onClick={onClose}>
            <X size={15} />
          </button>
        </header>

        {!apiKey ? (
          <div className="to-nex__setup">
            <p>{t('nex.setup')}</p>
            <p className="to-muted">{t('nex.privacy')}</p>
            <NexKeyForm />
          </div>
        ) : (
          <>
            <div className="to-nex__messages" ref={listRef} aria-live="polite">
              {bubbles.length === 0 && <p className="to-muted">{t('nex.hello')}</p>}
              {bubbles.map((bubble, index) => (
                <div key={index} className={`to-nex__bubble to-nex__bubble--${bubble.role}${bubble.error ? ' is-error' : ''}`}>
                  <p>{bubble.text}</p>
                  {bubble.actions && bubble.actions.length > 0 && (
                    <ul className="to-nex__actions">
                      {bubble.actions.map((action, i) => (
                        <li key={i}>
                          {t(`nex.action.${action.kind}`, { area: action.area })}: {action.label}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              {busy && <p className="to-muted">{t('nex.thinking')}</p>}
            </div>
            <form className="to-nex__composer" onSubmit={onSubmit}>
              <input
                autoFocus
                className="to-field__input"
                value={draft}
                placeholder={t('nex.placeholder')}
                aria-label={t('nex.placeholder')}
                onChange={(event) => setDraft(event.target.value)}
              />
              <Button type="submit" variant="primary" disabled={busy || !draft.trim()} aria-label={t('nex.send')}>
                <Send size={15} />
              </Button>
            </form>
          </>
        )}
      </section>
    </div>
  )
}
