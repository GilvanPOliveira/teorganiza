import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Card, Field, Stat, StatGrid, TextArea } from '@core/api/ui'
import { getModule } from '@core/registry/registry'
import { daysAgo, readActivity, weekStart } from './activity'
import { useCoreRecords, useCoreWriter } from './useCoreCollection'
import { useCoreT } from './useShell'

interface WeeklyReview {
  week: string
  wins: string
  blocked: string
  priorities: string[]
}

const EMPTY = (week: string): WeeklyReview => ({ week, wins: '', blocked: '', priorities: ['', '', ''] })

/** Saves a field when it loses focus: the review is written slowly, on purpose. */
function ReviewForm({ initial, onSave }: { initial: WeeklyReview; onSave: (r: WeeklyReview) => void }) {
  const t = useCoreT()
  const [draft, setDraft] = useState(initial)
  const save = (next: WeeklyReview) => {
    setDraft(next)
    onSave(next)
  }
  return (
    <div className="to-stack">
      <TextArea
        label={t('review.wins')}
        value={draft.wins}
        rows={3}
        onChange={(e) => setDraft({ ...draft, wins: e.target.value })}
        onBlur={() => save(draft)}
      />
      <TextArea
        label={t('review.blocked')}
        value={draft.blocked}
        rows={3}
        onChange={(e) => setDraft({ ...draft, blocked: e.target.value })}
        onBlur={() => save(draft)}
      />
      {[0, 1, 2].map((index) => (
        <Field
          key={index}
          label={t('review.priority', { n: index + 1 })}
          value={draft.priorities[index] ?? ''}
          onChange={(e) => {
            const priorities = [...draft.priorities]
            priorities[index] = e.target.value
            setDraft({ ...draft, priorities })
          }}
          onBlur={() => save(draft)}
        />
      ))}
    </div>
  )
}

export function Review() {
  const t = useCoreT()
  const week = weekStart()
  const reviews = useCoreRecords<WeeklyReview>('reviews', { where: { week } })
  const { create, update } = useCoreWriter<WeeklyReview>('reviews')
  const activity = useLiveQuery(() => readActivity(daysAgo(7)), []) ?? []
  const [existing] = reviews
  const busiest = [...activity].sort((a, b) => b.touched - a.touched).filter((a) => a.touched > 0)

  const onSave = (next: WeeklyReview) => {
    const clean = { ...next, priorities: next.priorities.map((p) => p.trim()) }
    void (existing ? update(existing.id, clean) : create(clean))
  }

  return (
    <div className="to-settings">
      <h1 className="to-settings__title">{t('nav.review')}</h1>
      <p className="to-muted">{t('review.lead')}</p>
      <StatGrid>
        <Stat label={t('review.created')} value={activity.reduce((sum, a) => sum + a.created, 0)} hint={t('review.last7')} />
        <Stat label={t('review.touched')} value={activity.reduce((sum, a) => sum + a.touched, 0)} hint={t('review.last7')} />
        <Stat
          label={t('review.busiest')}
          value={busiest[0] ? (getModule(busiest[0].moduleId)?.name ?? busiest[0].moduleId) : '—'}
        />
      </StatGrid>
      <Card title={t('review.questions')}>
        {/* Keyed by the stored record: when it loads, the form shows it. */}
        <ReviewForm key={existing?.id ?? 'new'} initial={existing?.data ?? EMPTY(week)} onSave={onSave} />
      </Card>
    </div>
  )
}
