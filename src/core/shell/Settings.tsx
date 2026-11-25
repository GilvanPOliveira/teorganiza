import { Link } from 'react-router-dom'
import { ChevronRight, Hash, Monitor, Moon, PanelBottom, PanelLeft, Sun, Trash2 } from 'lucide-react'
import { Card, Segmented, Switch } from '@core/api/ui'
import { AVAILABLE_LOCALES } from '@core/i18n/catalog'
import { getModules } from '@core/registry/registry'
import { useAppState } from '@core/runtime/app-context'
import { ACCENTS, type Accent, type Navigation, type ThemeChoice } from '@core/runtime/preferences'
import { ModuleIcon } from './ModuleIcon'
import { StorageSettings } from './SyncPanels'
import { useCoreT } from './useShell'

export function Settings() {
  const t = useCoreT()
  const { preferences, setPreferences } = useAppState()

  const toggleModule = (moduleId: string, on: boolean) => {
    const others = preferences.disabledModules.filter((id) => id !== moduleId)
    void setPreferences({ disabledModules: on ? others : [...others, moduleId] })
  }

  return (
    <div className="to-settings">
      <h1 className="to-settings__title">{t('settings.title')}</h1>

      <Card title={t('settings.appearance')}>
        <div className="to-settings__rows">
          <div className="to-settings__row">
            <span>{t('settings.theme')}</span>
            <Segmented<ThemeChoice>
              label={t('settings.theme')}
              value={preferences.theme}
              onChange={(theme) => void setPreferences({ theme })}
              options={[
                { value: 'dark', label: <><Moon size={14} />{t('settings.theme.dark')}</> },
                { value: 'light', label: <><Sun size={14} />{t('settings.theme.light')}</> },
                { value: 'system', label: <><Monitor size={14} />{t('settings.theme.system')}</> },
              ]}
            />
          </div>

          <div className="to-settings__row">
            <span>{t('settings.accent')}</span>
            <div className="to-swatches" role="radiogroup" aria-label={t('settings.accent')}>
              {ACCENTS.map((accent: Accent) => (
                <button
                  key={accent}
                  type="button"
                  role="radio"
                  aria-checked={preferences.accent === accent}
                  aria-label={t(`settings.accent.${accent}`)}
                  title={t(`settings.accent.${accent}`)}
                  data-swatch={accent}
                  className={`to-swatch${preferences.accent === accent ? ' is-active' : ''}`}
                  onClick={() => void setPreferences({ accent })}
                />
              ))}
            </div>
          </div>

          <div className="to-settings__row">
            <span>{t('settings.navigation')}</span>
            <Segmented<Navigation>
              label={t('settings.navigation')}
              value={preferences.navigation}
              onChange={(navigation) => void setPreferences({ navigation })}
              options={[
                { value: 'dock', label: <><PanelBottom size={14} />{t('settings.navigation.dock')}</> },
                { value: 'sidebar', label: <><PanelLeft size={14} />{t('settings.navigation.sidebar')}</> },
              ]}
            />
          </div>

          <div className="to-settings__row">
            <span>{t('settings.language')}</span>
            <select
              className="to-select"
              value={preferences.locale}
              onChange={(event) => void setPreferences({ locale: event.target.value })}
            >
              {AVAILABLE_LOCALES.map((value) => (
                <option key={value} value={value}>
                  {t(`settings.language.${value}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      <Card title={t('settings.modules')}>
        <p className="to-muted to-settings__lead">{t('settings.modules.note')}</p>
        <ul className="to-modulelist">
          {getModules().map((mod) => {
            const on = !preferences.disabledModules.includes(mod.id)
            return (
              <li key={mod.id} className="to-modulelist__item">
                <ModuleIcon icon={mod.icon} label={mod.name} size={18} boxed />
                <span className="to-modulelist__text">
                  <strong>{mod.name}</strong>
                  <span className="to-muted">
                    {t('settings.modules.version', { version: mod.version })}
                  </span>
                </span>
                <Switch
                  checked={on}
                  label={t('settings.modules.toggle', { name: mod.name })}
                  onChange={(value) => toggleModule(mod.id, value)}
                />
              </li>
            )
          })}
        </ul>
      </Card>

      <StorageSettings />

      <Link to="/tags" className="to-linkcard">
        <Hash size={18} />
        <span>
          <strong>{t('tags.title')}</strong>
          <span className="to-muted">{t('tags.lead')}</span>
        </span>
        <ChevronRight size={18} />
      </Link>

      <Link to="/settings/trash" className="to-linkcard">
        <Trash2 size={18} />
        <span>
          <strong>{t('trash.title')}</strong>
          <span className="to-muted">{t('trash.lead')}</span>
        </span>
        <ChevronRight size={18} />
      </Link>
    </div>
  )
}
