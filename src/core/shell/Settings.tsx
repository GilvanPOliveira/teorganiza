import { Link } from 'react-router-dom'
import { ChevronRight, Hash, Monitor, Moon, PanelBottom, PanelLeft, PanelLeftDashed, Sun, Trash2 } from 'lucide-react'
import { Button, Card, Segmented, Switch } from '@core/api/ui'
import { openNex, saveNexKey } from '@core/nex/key'
import { AVAILABLE_LOCALES } from '@core/i18n/catalog'
import { getModules } from '@core/registry/registry'
import { useAppState } from '@core/runtime/app-context'
import { ACCENTS, type Accent, type Navigation, type ThemeChoice } from '@core/runtime/preferences'
import { ModuleIcon } from './ModuleIcon'
import { hostOf, moduleAreas } from './navigation'
import { NexKeyForm, useNexKey } from './NexPanel'
import { StorageSettings } from './SyncPanels'
import { SHELL_AREAS, useCoreT } from './useShell'

export function Settings() {
  const t = useCoreT()
  const { preferences, setPreferences } = useAppState()

  const moduleEntries = getModules().flatMap(moduleAreas)
  const areas = [
    ...getModules().flatMap((mod) =>
      moduleAreas(mod).map((area) => {
        // A tab is listed right after its host, named after both.
        const host = hostOf(area, moduleEntries)
        return {
          ...area,
          label: host === area ? area.label : `${host.label} · ${area.tabLabel}`,
          order: host === area ? area.order : host.order + area.order / 10000,
          module: mod.name,
          version: mod.version,
        }
      }),
    ),
    ...SHELL_AREAS.map((area) => ({
      id: area.id,
      moduleId: null as string | null,
      label: t(area.labelKey),
      icon: area.icon,
      order: area.order,
      module: t('app.name'),
      version: null as string | null,
    })),
  ].sort((a, b) => a.order - b.order)

  const isOn = (id: string, moduleId: string | null) =>
    !preferences.disabledModules.includes(id) && !(moduleId && preferences.disabledModules.includes(moduleId))

  /** Turning one area back on, inside a module turned off whole, keeps its siblings off. */
  const toggleArea = (id: string, moduleId: string | null, on: boolean) => {
    let next = [...preferences.disabledModules]
    if (moduleId && next.includes(moduleId)) {
      next = next.filter((entry) => entry !== moduleId)
      for (const area of areas) if (area.moduleId === moduleId) next.push(area.id)
    }
    next = next.filter((entry) => entry !== id)
    if (!on) next.push(id)
    void setPreferences({ disabledModules: [...new Set(next)] })
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
                { value: 'dock-left', label: <><PanelLeftDashed size={14} />{t('settings.navigation.dockLeft')}</> },
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
          {areas.map((area) => {
            const on = isOn(area.id, area.moduleId)
            return (
              <li key={area.id} className="to-modulelist__item">
                <ModuleIcon icon={area.icon} label={area.label} size={18} boxed />
                <span className="to-modulelist__text">
                  <strong>{area.label}</strong>
                  <span className="to-muted">
                    {area.version
                      ? t('settings.modules.from', { module: area.module, version: area.version })
                      : area.module}
                  </span>
                </span>
                <Switch
                  checked={on}
                  label={t('settings.modules.toggle', { name: area.label })}
                  onChange={(value) => toggleArea(area.id, area.moduleId, value)}
                />
              </li>
            )
          })}
        </ul>
      </Card>

      <StorageSettings />
      <NexSettings />

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

/** The assistant's key: kept on this device only, never in sync. */
function NexSettings() {
  const t = useCoreT()
  const key = useNexKey()
  return (
    <Card title={t('settings.nex')}>
      <p className="to-muted">{t('nex.privacy')}</p>
      {key ? (
        <div className="to-toolbar">
          <span>{t('nex.key.saved')}</span>
          <Button variant="primary" onClick={() => openNex()}>
            {t('palette.openNex')}
          </Button>
          <Button variant="ghost" onClick={() => saveNexKey('')}>
            {t('nex.key.remove')}
          </Button>
        </div>
      ) : (
        <>
          <p>{t('nex.setup')}</p>
          <NexKeyForm />
        </>
      )}
    </Card>
  )
}
