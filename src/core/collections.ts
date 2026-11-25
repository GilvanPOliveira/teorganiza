import { z } from 'zod'
import type { AnyCollectionDef } from '@core/api/types'

/**
 * The shell stores user data too, and it is not a special case: same
 * envelope, same merge, same sync. That is why the dashboard layout
 * follows you from the phone to the desktop.
 */
export const CORE_MODULE_ID = 'core'

export const dashboardEntrySchema = z.object({
  /** '<moduleId>/<widgetId>' */
  widget: z.string(),
  order: z.number().int(),
})

export const ACCENTS = ['blue', 'violet', 'green', 'amber', 'rose', 'cyan'] as const

/**
 * New fields are optional rather than a schema bump: a record written by an
 * older build still validates, and the defaults fill the gaps on read.
 */
export const preferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  locale: z.string(),
  syncPolicy: z.enum(['manual', 'on-leave', 'periodic', 'always']),
  accent: z.enum(ACCENTS).optional(),
  navigation: z.enum(['dock', 'sidebar']).optional(),
  /** Turned off, a module leaves the navigation; its data stays untouched. */
  disabledModules: z.array(z.string()).optional(),
})

export const knownDeviceSchema = z.object({
  deviceId: z.string(),
  nickname: z.string(),
  lastSeenAt: z.string(),
})

export const moduleSettingsSchema = z.object({
  moduleId: z.string(),
  values: z.record(z.unknown()),
})

export const coreCollections: AnyCollectionDef[] = [
  {
    name: 'dashboard',
    schema: dashboardEntrySchema,
    schemaVersion: 1,
    describe: (record) => `Widget ${record.data.widget}`,
    indexes: ['widget'],
  },
  {
    name: 'preferences',
    schema: preferencesSchema,
    schemaVersion: 1,
    describe: (record) => `Preferências (${record.data.locale})`,
  },
  {
    name: 'devices',
    schema: knownDeviceSchema,
    schemaVersion: 1,
    describe: (record) => record.data.nickname,
    indexes: ['deviceId'],
  },
  {
    name: 'settings',
    schema: moduleSettingsSchema,
    schemaVersion: 1,
    describe: (record) => `Configurações de ${record.data.moduleId}`,
    indexes: ['moduleId'],
  },
]
