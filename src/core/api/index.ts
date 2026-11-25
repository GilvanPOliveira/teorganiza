/**
 * The single public surface a module may import.
 *
 *   import { useRecords, useCollection, Button, useT } from '@core/api'
 *
 * The lint boundary makes this the only path out of `modules/`. If a
 * module needs something that is not here, that is a change to the
 * contract — an issue, never a shortcut.
 *
 * What is deliberately absent, and why:
 *   - raw Dexie            swapping the local database would break every module
 *   - storage adapters     sync is the core's responsibility alone
 *   - other modules' data  integration happens through events
 *   - network access       a module makes no requests
 *   - localStorage         data outside the envelope never syncs or migrates
 */

export type {
  AppContextValue,
  CollectionDef,
  Envelope,
  EventHandler,
  EventPayload,
  Filter,
  MigrationFn,
  Module,
  Query,
  RangeFilter,
  RouteDef,
  StorageKind,
  StorageState,
  WidgetDef,
  WidgetSize,
} from './types'

export { MODULE_API_VERSION } from './types'

export { defineModule } from './defineModule'

export {
  useAppContext,
  useCollection,
  useCount,
  useEmit,
  useFormat,
  useNavigate,
  useParams,
  useRecord,
  useRecords,
  useSettings,
  useT,
} from './hooks'

export type { CollectionWriter, Formatter } from './hooks'

export { Button, Card, EmptyState, Field, Table, Toolbar } from './ui'
