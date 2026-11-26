import { useEffect } from 'react'
import { Bot, X } from 'lucide-react'
import { useCoreT } from './useShell'

/**
 * Nex's place in the app. For now it only says what Nex will be: there is
 * no AI and no API behind it, and nothing is sent anywhere.
 */
export function NexPanel({ onClose }: { onClose: () => void }) {
  const t = useCoreT()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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
        <div className="to-nex__setup">
          <p>{t('nex.soon')}</p>
          <p className="to-muted">{t('nex.soon.body')}</p>
        </div>
      </section>
    </div>
  )
}
