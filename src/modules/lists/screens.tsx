import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, Flag, Paperclip, Trash2 } from 'lucide-react'
import {
  Attachments,
  Badge,
  Button,
  Checkbox,
  EmptyState,
  Progress,
  QuickAdd,
  Segmented,
  TagList,
  toLocalISODate,
  useCollection,
  useCreateTag,
  useFormat,
  useNavigate,
  useOpenHref,
  useParams,
  useRecords,
  useT,
  type Envelope,
} from '@core/api'
import { parseTask } from './parse'
import type { Item, List, Status } from './schema'

const STATUSES: Status[] = ['todo', 'doing', 'done']

/** Adds an item from one typed line: date, #tags and ! come out of the text. */
function useAddItem(listId: string | null) {
  const { create } = useCollection<Item>('items')
  const createTag = useCreateTag()
  return async (text: string) => {
    const parsed = parseTask(text)
    const tagIds = await Promise.all(parsed.tags.map((name) => createTag(name)))
    await create(
      { listId, title: parsed.title, status: 'todo', done: false, due: parsed.due, priority: parsed.priority },
      tagIds,
    )
  }
}

function useItemActions() {
  const { update, remove } = useCollection<Item>('items')
  return {
    toggle: (item: Envelope<Item>) =>
      update(item.id, item.data.done ? { done: false, status: 'todo' } : { done: true, status: 'done' }),
    move: (item: Envelope<Item>, status: Status) => update(item.id, { status, done: status === 'done' }),
    remove: (item: Envelope<Item>) => remove(item.id),
  }
}

function ItemRow({ item, listName }: { item: Envelope<Item>; listName?: string }) {
  const t = useT()
  const format = useFormat()
  const actions = useItemActions()
  const today = toLocalISODate()
  const late = item.data.due !== null && item.data.due < today && !item.data.done
  const [filesOpen, setFilesOpen] = useState(false)

  return (
    <li className={`to-list__item to-list__item--wrap${item.data.done ? ' is-done' : ''}`}>
      <Checkbox checked={item.data.done} label={t('item.toggle', { title: item.data.title })} onChange={() => void actions.toggle(item)} />
      <div className="to-list__main">
        <span className="to-list__title">{item.data.title}</span>
        {(item.data.due || listName || (item.tags ?? []).length > 0 || item.data.priority === 'high') && (
          <span className="to-list__meta">
            {item.data.priority === 'high' && (
              <Badge tone="negative">
                <Flag size={11} />
                {t('item.high')}
              </Badge>
            )}
            {item.data.due && (
              <Badge tone={late ? 'negative' : item.data.due === today ? 'accent' : undefined}>
                {item.data.due === today ? t('when.today') : format.date(item.data.due)}
              </Badge>
            )}
            {listName && <span>{listName}</span>}
            <TagList ids={item.tags} />
          </span>
        )}
      </div>
      <div className="to-list__actions">
        <button
          type="button"
          className={`to-iconbutton to-iconbutton--small${filesOpen ? ' active' : ''}`}
          aria-label={t('item.files')}
          title={t('item.files')}
          aria-expanded={filesOpen}
          onClick={() => setFilesOpen((open) => !open)}
        >
          <Paperclip size={14} />
        </button>
        <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('item.remove')} onClick={() => void actions.remove(item)}>
          <Trash2 size={14} />
        </button>
      </div>
      {filesOpen && (
        <div className="to-list__extra">
          <Attachments collection="items" id={item.id} />
        </div>
      )}
    </li>
  )
}

function ItemList({ items, lists }: { items: Envelope<Item>[]; lists?: Map<string, string> }) {
  if (items.length === 0) return null
  return (
    <ul className="to-list">
      {items.map((item) => (
        <ItemRow key={item.id} item={item} listName={item.data.listId ? lists?.get(item.data.listId) : undefined} />
      ))}
    </ul>
  )
}

function byDueThenCreated(a: Envelope<Item>, b: Envelope<Item>) {
  const left = a.data.due ?? '9999'
  const right = b.data.due ?? '9999'
  return left === right ? a.id.localeCompare(b.id) : left.localeCompare(right)
}

function useListNames(): Map<string, string> {
  const lists = useRecords<List>('lists')
  return useMemo(() => new Map(lists.map((list) => [list.id, list.data.name])), [lists])
}

/* ------------------------------------------------------------------ *
 * Tarefas, with a switch for what is from work and what is from home
 * ------------------------------------------------------------------ */

type Scope = 'all' | 'work' | 'home'

/** The list that holds a scope's tasks, created with its first task. */
function useScopeList(scope: Scope) {
  const t = useT()
  const lists = useRecords<List>('lists')
  const { create } = useCollection<List>('lists')
  const kind = scope === 'all' ? null : scope
  const existing = kind ? lists.find((list) => list.data.kind === kind) : undefined
  return {
    lists,
    ensure: async (): Promise<string | null> => {
      if (!kind) return null
      if (existing) return existing.id
      return create({ name: t(`kind.${kind}`), kind, archived: false, due: null })
    },
  }
}

export function TasksScreen({ scope = 'all' }: { scope?: Scope }) {
  const t = useT()
  const navigate = useNavigate()
  const items = useRecords<Item>('items')
  const names = useListNames()
  const { lists, ensure } = useScopeList(scope)
  const { create } = useCollection<Item>('items')
  const createTag = useCreateTag()
  const today = toLocalISODate()

  const kindOf = new Map(lists.map((list) => [list.id, list.data.kind]))
  // Films and series moved to the shelf; their old rows never count as tasks.
  const mine = items.filter((item) => {
    const kind = item.data.listId ? kindOf.get(item.data.listId) : undefined
    if (kind === 'media') return false
    return scope === 'all' || kind === scope
  })

  const add = async (text: string) => {
    const parsed = parseTask(text)
    const listId = await ensure()
    const tagIds = await Promise.all(parsed.tags.map((name) => createTag(name)))
    await create(
      { listId, title: parsed.title, status: 'todo', done: false, due: parsed.due, priority: parsed.priority },
      tagIds,
    )
  }

  const open = mine.filter((item) => !item.data.done).sort(byDueThenCreated)
  const groups = [
    { key: 'late', items: open.filter((i) => i.data.due !== null && i.data.due < today) },
    { key: 'today', items: open.filter((i) => i.data.due === today) },
    { key: 'next', items: open.filter((i) => i.data.due !== null && i.data.due > today) },
    { key: 'someday', items: open.filter((i) => i.data.due === null) },
  ]
  const done = mine.filter((item) => item.data.done).slice(-10).reverse()

  return (
    <div className="to-stack">
      <Segmented<Scope>
        label={t('tasks.scope')}
        value={scope}
        onChange={(next) => navigate(next === 'all' ? '' : next)}
        options={[
          { value: 'all', label: t('tasks.scope.all') },
          { value: 'work', label: t('kind.work') },
          { value: 'home', label: t('kind.home') },
        ]}
      />
      <QuickAdd placeholder={t(scope === 'all' ? 'tasks.placeholder' : `kind.${scope}.placeholder`)} onAdd={add} />
      {mine.length === 0 ? (
        <EmptyState
          title={t(scope === 'all' ? 'tasks.empty.title' : `kind.${scope}.empty`)}
          body={t(scope === 'all' ? 'tasks.empty.body' : 'kind.empty.body')}
        />
      ) : (
        <>
          {groups.map(
            (group) =>
              group.items.length > 0 && (
                <section key={group.key} className="to-stack">
                  <h2 className="to-section-title">
                    {t(`tasks.group.${group.key}`)} · {group.items.length}
                  </h2>
                  <ItemList items={group.items} lists={scope === 'all' ? names : undefined} />
                </section>
              ),
          )}
          {done.length > 0 && (
            <section className="to-stack">
              <h2 className="to-section-title">{t('tasks.group.done')}</h2>
              <ItemList items={done} lists={scope === 'all' ? names : undefined} />
            </section>
          )}
        </>
      )}
    </div>
  )
}

export const WorkScreen = () => <TasksScreen scope="work" />
export const HomeScreen = () => <TasksScreen scope="home" />

/* ------------------------------------------------------------------ *
 * Projetos: a list to create them, and a board inside each one
 * ------------------------------------------------------------------ */

export function ProjectsScreen() {
  const t = useT()
  const format = useFormat()
  const navigate = useNavigate()
  const lists = useRecords<List>('lists', { where: { kind: 'project' } })
  const items = useRecords<Item>('items')
  const { create } = useCollection<List>('lists')
  const [due, setDue] = useState('')
  const today = toLocalISODate()

  return (
    <div className="to-stack">
      <QuickAdd
        placeholder={t('projects.placeholder')}
        onAdd={async (name) => {
          const id = await create({ name, kind: 'project', archived: false, due: due || null })
          setDue('')
          navigate(`projects/${id}`)
        }}
      >
        <input
          type="date"
          className="to-field__input"
          value={due}
          aria-label={t('projects.deadline')}
          title={t('projects.deadline')}
          onChange={(e) => setDue(e.target.value)}
        />
      </QuickAdd>
      {lists.length === 0 ? (
        <EmptyState title={t('projects.empty.title')} body={t('projects.empty.body')} />
      ) : (
        <div className="to-cards">
          {lists.map((list) => {
            const mine = items.filter((item) => item.data.listId === list.id)
            const done = mine.filter((item) => item.data.done).length
            const doing = mine.filter((item) => item.data.status === 'doing').length
            const late = Boolean(list.data.due && list.data.due < today && done < mine.length)
            return (
              <button
                key={list.id}
                type="button"
                className="to-tile to-tile--button"
                onClick={() => navigate(`projects/${list.id}`)}
              >
                <span className="to-tile__row">
                  <h3 className="to-tile__title">{list.data.name}</h3>
                  {list.data.due && <Badge tone={late ? 'negative' : undefined}>{format.date(list.data.due)}</Badge>}
                </span>
                <Progress value={done} max={Math.max(mine.length, 1)} label={list.data.name} />
                <span className="to-tile__row">
                  <span>{t('projects.progress', { done, total: mine.length })}</span>
                  <span>{mine.length ? Math.round((done / mine.length) * 100) : 0}%</span>
                </span>
                {doing > 0 && <span className="to-muted">{t('projects.doing', { count: doing })}</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** The three columns. Cards move with the arrows. */
function Board({ items }: { items: Envelope<Item>[] }) {
  const t = useT()
  const format = useFormat()
  const actions = useItemActions()
  const [filesFor, setFilesFor] = useState<string | null>(null)
  return (
    <div className="to-columns">
      {STATUSES.map((status, index) => {
        const column = items.filter((item) => item.data.status === status).sort(byDueThenCreated)
        return (
          <section key={status} className="to-column">
            <h2 className="to-column__title">
              <span>{t(`status.${status}`)}</span>
              <Badge>{column.length}</Badge>
            </h2>
            {column.map((item) => (
              <article key={item.id} className="to-column__card">
                <span>{item.data.title}</span>
                <span className="to-list__meta">
                  {item.data.due && <Badge>{format.date(item.data.due)}</Badge>}
                  <TagList ids={item.tags} />
                </span>
                <div className="to-column__moves">
                  {index > 0 && (
                    <button
                      type="button"
                      className="to-iconbutton to-iconbutton--small"
                      aria-label={t('kanban.back')}
                      onClick={() => void actions.move(item, STATUSES[index - 1])}
                    >
                      <ChevronLeft size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    className={`to-iconbutton to-iconbutton--small${filesFor === item.id ? ' active' : ''}`}
                    aria-label={t('item.files')}
                    onClick={() => setFilesFor((open) => (open === item.id ? null : item.id))}
                  >
                    <Paperclip size={14} />
                  </button>
                  <button
                    type="button"
                    className="to-iconbutton to-iconbutton--small"
                    aria-label={t('item.remove')}
                    onClick={() => void actions.remove(item)}
                  >
                    <Trash2 size={14} />
                  </button>
                  {index < STATUSES.length - 1 && (
                    <button
                      type="button"
                      className="to-iconbutton to-iconbutton--small"
                      aria-label={t('kanban.forward')}
                      onClick={() => void actions.move(item, STATUSES[index + 1])}
                    >
                      <ChevronRight size={14} />
                    </button>
                  )}
                </div>
                {filesFor === item.id && <Attachments collection="items" id={item.id} />}
              </article>
            ))}
          </section>
        )
      })}
    </div>
  )
}

/** Opening a project is opening its board: where it gets done. */
export function ProjectScreen() {
  const t = useT()
  const navigate = useNavigate()
  const { projectId = '' } = useParams<{ projectId: string }>()
  const lists = useRecords<List>('lists')
  const project = lists.find((list) => list.id === projectId)
  const items = useRecords<Item>('items', { where: { listId: projectId } })
  const add = useAddItem(projectId)
  const { update, remove } = useCollection<List>('lists')
  const done = items.filter((item) => item.data.done).length

  if (!project) return <EmptyState title={t('projects.missing')} />

  return (
    <div className="to-stack">
      <div className="to-toolbar">
        <Button variant="ghost" onClick={() => navigate('projects')}>
          <ArrowLeft size={15} />
          {t('projects.back')}
        </Button>
      </div>
      <span className="to-tile__row">
        <h2 className="to-tile__title">{project.data.name}</h2>
        <label className="to-inline-field">
          <span className="to-muted">{t('projects.deadline')}</span>
          <input
            type="date"
            className="to-field__input"
            value={project.data.due ?? ''}
            onChange={(e) => void update(project.id, { due: e.target.value || null })}
          />
        </label>
      </span>
      <Progress value={done} max={Math.max(items.length, 1)} label={project.data.name} />
      <span className="to-muted">{t('projects.progress', { done, total: items.length })}</span>
      <QuickAdd placeholder={t('tasks.placeholder')} onAdd={add} />
      {items.length === 0 ? (
        <EmptyState title={t('project.empty')} body={t('project.empty.body')} />
      ) : (
        <Board items={items} />
      )}
      <div className="to-toolbar">
        <Button
          variant="danger"
          onClick={() => {
            void remove(project.id)
            navigate('projects')
          }}
        >
          <Trash2 size={15} />
          {t('projects.remove')}
        </Button>
      </div>
    </div>
  )
}

/** The old board of every project at once now lives inside each project. */
export function KanbanRedirect() {
  const navigate = useNavigate()
  useEffect(() => navigate('projects'), [navigate])
  return null
}

/** Films and series now live on the shelf, with states of their own. */
export function MediaRedirect() {
  const open = useOpenHref()
  useEffect(() => open('/reading/media'), [open])
  return null
}
