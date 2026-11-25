import { useEffect, useState } from 'react'
import { GraduationCap, Trash2 } from 'lucide-react'
import {
  Badge,
  Button,
  Card as Panel,
  EmptyState,
  QuickAdd,
  Select,
  Stat,
  StatGrid,
  toLocalISODate,
  useCollection,
  useRecords,
  useT,
  type Envelope,
} from '@core/api'
import { newCard, review } from './schedule'
import type { Card, Course, Grade } from './schema'

export function CoursesScreen() {
  const t = useT()
  const courses = useRecords<Course>('courses')
  const cards = useRecords<Card>('cards')
  const courseWriter = useCollection<Course>('courses')
  const cardWriter = useCollection<Card>('cards')
  const [courseId, setCourseId] = useState('')
  const [back, setBack] = useState('')
  const today = toLocalISODate()
  const due = cards.filter((card) => card.data.due <= today)

  return (
    <div className="to-stack">
      <StatGrid>
        <Stat label={t('stats.due')} value={due.length} hint={t('stats.dueHint')} />
        <Stat label={t('stats.cards')} value={cards.length} />
        <Stat label={t('stats.courses')} value={courses.length} />
      </StatGrid>

      <Panel title={t('courses.title')}>
        <div className="to-stack">
          <QuickAdd placeholder={t('courses.placeholder')} onAdd={(name) => void courseWriter.create({ name, weeklyHours: 0 })} />
          {courses.length === 0 ? (
            <p className="to-muted">{t('courses.empty')}</p>
          ) : (
            <ul className="to-list">
              {courses.map((course) => {
                const mine = cards.filter((card) => card.data.courseId === course.id)
                return (
                  <li key={course.id} className="to-list__item">
                    <GraduationCap size={16} />
                    <div className="to-list__main">
                      <span className="to-list__title">{course.data.name}</span>
                      <span className="to-list__meta">
                        <Badge>{t('courses.cards', { count: mine.length })}</Badge>
                        <Badge tone="accent">{t('courses.due', { count: mine.filter((c) => c.data.due <= today).length })}</Badge>
                      </span>
                    </div>
                    <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('courses.remove')} onClick={() => void courseWriter.remove(course.id)}>
                      <Trash2 size={14} />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </Panel>

      <Panel title={t('cards.title')}>
        <div className="to-stack">
          <Select
            label={t('cards.course')}
            value={courseId}
            onChange={setCourseId}
            options={[{ value: '', label: t('cards.noCourse') }, ...courses.map((c) => ({ value: c.id, label: c.data.name }))]}
          />
          <QuickAdd
            placeholder={t('cards.front')}
            onAdd={async (front) => {
              if (!back.trim()) return
              await cardWriter.create(newCard(front, back.trim(), courseId || null))
              setBack('')
            }}
          >
            <input className="to-field__input" value={back} placeholder={t('cards.back')} aria-label={t('cards.back')} onChange={(e) => setBack(e.target.value)} />
          </QuickAdd>
          <p className="to-muted">{t('cards.hint')}</p>
        </div>
      </Panel>
    </div>
  )
}

function ReviewCard({ card, onGrade }: { card: Envelope<Card>; onGrade: (grade: Grade) => void }) {
  const t = useT()
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      if (event.key === ' ' && !shown) {
        event.preventDefault()
        setShown(true)
      } else if (shown && ['1', '2', '3', '4'].includes(event.key)) {
        onGrade(Number(event.key) as Grade)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shown, onGrade])

  return (
    <div className="to-stack">
      <div className="to-flashcard">
        <span>{card.data.front}</span>
        {shown && <span className="to-flashcard__back">{card.data.back}</span>}
      </div>
      {shown ? (
        <div className="to-toolbar to-toolbar--spread">
          {([1, 2, 3, 4] as Grade[]).map((grade) => (
            <Button key={grade} variant={grade === 3 ? 'primary' : 'secondary'} onClick={() => onGrade(grade)}>
              <kbd className="to-kbd">{grade}</kbd> {t(`grade.${grade}`)}
            </Button>
          ))}
        </div>
      ) : (
        <Button variant="primary" onClick={() => setShown(true)}>
          {t('review.show')} <kbd className="to-kbd">{t('review.space')}</kbd>
        </Button>
      )}
    </div>
  )
}

export function ReviewScreen() {
  const t = useT()
  const today = toLocalISODate()
  const cards = useRecords<Card>('cards')
  const { update } = useCollection<Card>('cards')
  const due = cards.filter((card) => card.data.due <= today).sort((a, b) => a.data.due.localeCompare(b.data.due))
  const [current] = due

  if (!current) return <EmptyState title={t('review.done.title')} body={t('review.done.body')} />

  return (
    <div className="to-stack to-narrow">
      <p className="to-muted">{t('review.left', { count: due.length })}</p>
      <ReviewCard key={current.id} card={current} onGrade={(grade) => void update(current.id, review(current.data, grade))} />
    </div>
  )
}
