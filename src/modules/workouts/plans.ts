import { useEffect, useMemo } from 'react'
import { toLocalISODate, useCollection, useRecords, type Envelope } from '@core/api'
import { useRoutines, useTrainingSettings } from './data'
import { snapshotRoutines, snapshotsByDay } from './logic'
import type { PlanSnapshot } from './schema'

export function usePlanSnapshots(): Envelope<PlanSnapshot>[] {
  const rows = useRecords<PlanSnapshot>('plans', { sort: { field: 'date', dir: 'desc' } })
  return useMemo(() => snapshotsByDay(rows), [rows])
}

/**
 * Keeps the sheet's history: when the sheet differs from its last kept
 * version, today's version is saved (one per day, updated through the
 * day). It waits a moment after a change, so the saved records are loaded
 * and a burst of edits makes a single write.
 */
export function useKeepPlanHistory() {
  const routines = useRoutines()
  const [settings] = useTrainingSettings()
  const snapshots = usePlanSnapshots()
  const { create, update } = useCollection<PlanSnapshot>('plans')
  const current = useMemo(() => snapshotRoutines(routines.map((r) => r.data), settings.off ?? []), [routines, settings.off])
  const signature = JSON.stringify(current)
  const lastSignature = snapshots[0] ? JSON.stringify(snapshots[0].data.routines) : null
  const lastId = snapshots[0]?.id
  const lastDate = snapshots[0]?.data.date

  useEffect(() => {
    if (current.length === 0 || signature === lastSignature) return
    const timer = window.setTimeout(() => {
      const today = toLocalISODate()
      const data = { date: today, savedAt: new Date().toISOString(), routines: current }
      if (lastId && lastDate === today) void update(lastId, data)
      else void create(data)
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [signature, lastSignature, lastId, lastDate, current, create, update])
}
