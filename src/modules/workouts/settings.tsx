import { useT } from '@core/api'
import { REST_OPTIONS } from './browser'
import { useTrainingSettings } from './data'
import { clock } from './logic'

/**
 * How the workout screen behaves: effort per set, default rest, one
 * exercise at a time or a list, and the sound at the end of a rest.
 * Opened from the workout's own menu, where these matter.
 */
export function TrainingSettingsFields() {
  const t = useT()
  const [settings, setSettings] = useTrainingSettings()
  return (
    <>
      <div className="to-toolbar">
        <label className="to-inline-field">
          <span className="to-muted">{t('settings.effort')}</span>
          <select className="to-field__input" value={settings.effort} onChange={(e) => void setSettings({ effort: e.target.value as 'none' | 'rir' | 'rpe' })}>
            <option value="none">{t('settings.effort.none')}</option>
            <option value="rir">RIR</option>
            <option value="rpe">RPE</option>
          </select>
        </label>
        <label className="to-inline-field">
          <span className="to-muted">{t('settings.rest')}</span>
          <select className="to-field__input" value={settings.rest} onChange={(e) => void setSettings({ rest: Number(e.target.value) })}>
            {REST_OPTIONS.filter((s) => s > 0).map((s) => (
              <option key={s} value={s}>
                {clock(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="to-inline-field">
          <span className="to-muted">{t('settings.view')}</span>
          <select className="to-field__input" value={settings.view} onChange={(e) => void setSettings({ view: e.target.value as 'cards' | 'list' })}>
            <option value="cards">{t('settings.view.cards')}</option>
            <option value="list">{t('settings.view.list')}</option>
          </select>
        </label>
        <label className="to-inline-field">
          <input type="checkbox" checked={settings.sound} onChange={(e) => void setSettings({ sound: e.target.checked })} />
          <span>{t('settings.sound')}</span>
        </label>
      </div>
      <p className="to-muted">{t('settings.hint')}</p>
    </>
  )
}
