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
  AreaDef,
  CollectionDef,
  CommandDef,
  DatedEntry,
  ProgressEntry,
  ProviderReader,
  Providers,
  IconProps,
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

export { parseDate, toLocalISODate } from './dates'

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
  useCreateTag,
  useT,
  useTags,
  useDated,
  useProgressSources,
  useOpenHref,
} from './hooks'

export type { CollectionWriter, Formatter, Tag } from './hooks'
export type { CollectedDated, CollectedProgress } from '@core/providers/collect'

export { TagList, TagPicker } from './tags'

export { Attachments, FileDrop, FileRows, formatSize, useAddFiles, useFiles } from './files'
export type { StoredFile } from '@core/collections'

export {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Field,
  Progress,
  QuickAdd,
  Segmented,
  Select,
  Stat,
  StatGrid,
  Switch,
  Table,
  TextArea,
  Toolbar,
} from './ui'
