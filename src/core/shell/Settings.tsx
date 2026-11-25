import { Card } from '@core/api/ui'
import { AVAILABLE_LOCALES, translate } from '@core/i18n/catalog'
import { getModules } from '@core/registry/registry'
import { useAppState } from '@core/runtime/app-context'

export function Settings() {
  const { locale, theme, deviceId, storage, setLocale, setTheme } = useAppState()
  const t = (key: string, vars?: Record<string, unknown>) =>
    translate(locale, 'core', key, vars)

  return (
    <div className="to-settings">
      <Card title={t('settings.storage')}>
        <p>{storage.kind ?? t('storage.none')}</p>
        <p className="to-muted">
          {t('storage.warning.body', { count: storage.pendingCount })}
        </p>
        <p className="to-muted">device: {deviceId}</p>
      </Card>

      <Card title={t('settings.language')}>
        <select value={locale} onChange={(event) => setLocale(event.target.value)}>
          {AVAILABLE_LOCALES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </Card>

      <Card title={t('settings.appearance')}>
        <select
          value={theme}
          onChange={(event) => setTheme(event.target.value as 'light' | 'dark')}
        >
          <option value="light">light</option>
          <option value="dark">dark</option>
        </select>
      </Card>

      <Card title={t('settings.modules')}>
        <ul>
          {getModules().map((mod) => (
            <li key={mod.id}>
              {mod.name} — <code>{mod.id}</code> v{mod.version} (API v{mod.apiVersion})
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
