import { BatteryLow, Beef, Utensils, Zap } from 'lucide-react'
import { NoteList, useProfile, useSignals, useT, type DataNote } from '@core/api'
import { readinessNotes } from './readiness'

/** Today's notes from sleep, energy and the week's eating, under the planned workout. */
export function ReadinessNotes() {
  const t = useT()
  const signals = useSignals()
  const { profile, facts } = useProfile()
  const notes: DataNote[] = readinessNotes(signals, facts, profile.goal).map((note): DataNote => {
    switch (note.kind) {
      case 'light': {
        const why = [note.sleep !== null && note.sleep < 6 && t('ready.sleep', { hours: String(note.sleep).replace('.', ',') }), note.energy !== null && note.energy <= 2 && t('ready.energy')]
          .filter(Boolean)
          .join(' e ')
        return {
          key: note.kind,
          tone: 'warn',
          icon: <BatteryLow size={15} />,
          text: (
            <>
              <strong>{t('ready.lightTitle')}</strong> {t('ready.lightBody', { why })}
            </>
          ),
        }
      }
      case 'ready':
        return { key: note.kind, tone: 'good', icon: <Zap size={15} />, text: t('ready.good') }
      case 'underfed':
      case 'overfed':
        return { key: note.kind, tone: 'warn', icon: <Utensils size={15} />, text: t(`ready.${note.kind}`, { kcal: note.kcal, target: note.target, days: note.days }) }
      case 'lowProtein':
        return { key: note.kind, tone: 'warn', icon: <Beef size={15} />, text: t('ready.lowProtein', { protein: note.protein, target: note.target, days: note.days }) }
    }
  })
  return <NoteList notes={notes} />
}
