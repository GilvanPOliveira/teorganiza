import { useCollection, useT } from '@core/api'
import { ExerciseBrowser } from './browser'
import { useSessions, useTrainingSettings, withIds } from './data'
import { entryFromPlan } from './logic'
import type { Session } from './schema'

/** Every exercise; with a workout running, each one can go straight into it. */
export function LibraryScreen() {
  const t = useT()
  const [settings] = useTrainingSettings()
  const sessions = useSessions()
  const { update } = useCollection<Session>('sessions')
  const active = sessions.find((s) => !s.data.finishedAt)
  const finished = withIds(sessions).filter((s) => s.finishedAt)

  return (
    <ExerciseBrowser
      action={
        active
          ? {
              label: t('library.addToActive'),
              withLoad: true,
              keepOpen: true,
              onAdd: (exercise, plan) => void update(active.id, { entries: [...active.data.entries, entryFromPlan(exercise, plan, finished, settings.rest)] }),
            }
          : undefined
      }
    />
  )
}
