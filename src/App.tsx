import { useMemo } from 'react'
import { RouterProvider } from 'react-router-dom'
import { openDatabase } from '@core/db/database'
import { buildCatalog } from '@core/i18n/catalog'
import { registerModules } from '@core/registry/registry'
import { buildRouter } from '@core/router/routes'
import { AppProvider } from '@core/runtime/app-context'
import { wireListeners } from '@core/runtime/events'
import { runMigrations } from './migrations'
import { modules } from './modules'

/**
 * The composition root. This is the only place that knows both sides:
 * it reads the module list and hands it to the core. `core/` itself
 * never imports from `modules/`, and the lint boundary enforces that.
 */
registerModules(modules)
wireListeners(modules)
buildCatalog(modules)
openDatabase()
void runMigrations()

export default function App() {
  const router = useMemo(() => buildRouter(), [])
  return (
    <AppProvider>
      <RouterProvider router={router} />
    </AppProvider>
  )
}
