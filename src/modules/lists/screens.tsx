import { useMemo, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, Flag, Paperclip, Trash2 } from 'lucide-react'
import {
  Attachments,
  Badge,
  Button,
  Checkbox,
  EmptyState,
  Progress,
  QuickAdd,
  TagList,
  toLocalISODate,
  useCollection,
  useCreateTag,
  useFormat,
  useNavigate,
  useParams,
  useRecords,
  useT,
  type Envelope,
} from '@core/api'
import { parseTask } from './parse'
import type { Item, List, ListKind, Status } from './schema'

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
 * Tarefas
 * ------------------------------------------------------------------ */

export function TasksScreen() {
  const t = useT()
  const items = useRecords<Item>('items')
  const names = useListNames()
  const add = useAddItem(null)
  const today = toLocalISODate()

  const open = items.filter((item) => !item.data.done).sort(byDueThenCreated)
  const groups = [
    { key: 'late', items: open.filter((i) => i.data.due !== null && i.data.due < today) },
    { key: 'today', items: open.filter((i) => i.data.due === today) },
    { key: 'next', items: open.filter((i) => i.data.due !== null && i.data.due > today) },
    { key: 'someday', items: open.filter((i) => i.data.due === null) },
  ]
  const done = items.filter((item) => item.data.done).slice(-10).reverse()

  return (
    <div className="to-stack">
      <QuickAdd placeholder={t('tasks.placeholder')} onAdd={add} />
      {items.length === 0 ? (
        <EmptyState title={t('tasks.empty.title')} body={t('tasks.empty.body')} />
      ) : (
        <>
          {groups.map(
            (group) =>
              group.items.length > 0 && (
                <section key={group.key} className="to-stack">
                  <h2 className="to-section-title">
                    {t(`tasks.group.${group.key}`)} · {group.items.length}
                  </h2>
                  <ItemList items={group.items} lists={names} />
                </section>
              ),
          )}
          {done.length > 0 && (
            <section className="to-stack">
              <h2 className="to-section-title">{t('tasks.group.done')}</h2>
              <ItemList items={done} lists={names} />
            </section>
          )}
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Projetos
 * ------------------------------------------------------------------ */

export function ProjectsScreen() {
  const t = useT()
  const navigate = useNavigate()
  const lists = useRecords<List>('lists', { where: { kind: 'project' } })
  const items = useRecords<Item>('items')
  const { create } = useCollection<List>('lists')

  return (
    <div className="to-stack">
      <QuickAdd
        placeholder={t('projects.placeholder')}
        onAdd={(name) => void create({ name, kind: 'project', archived: false })}
      />
      {lists.length === 0 ? (
        <EmptyState title={t('projects.empty.title')} body={t('projects.empty.body')} />
      ) : (
        <div className="to-cards">
          {lists.map((list) => {
            const mine = items.filter((item) => item.data.listId === list.id)
            const done = mine.filter((item) => item.data.done).length
            return (
              <button
                key={list.id}
                type="button"
                className="to-tile to-tile--button"
                onClick={() => navigate(`projects/${list.id}`)}
              >
                <h3 className="to-tile__title">{list.data.name}</h3>
                <Progress value={done} max={Math.max(mine.length, 1)} label={list.data.name} />
                <span className="to-tile__row">
                  <span>{t('projects.progress', { done, total: mine.length })}</span>
                  <span>{mine.length ? Math.round((done / mine.length) * 100) : 0}%</span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function ProjectScreen() {
  const t = useT()
  const navigate = useNavigate()
  const { projectId = '' } = useParams<{ projectId: string }>()
  const lists = useRecords<List>('lists')
  const project = lists.find((list) => list.id === projectId)
  const items = useRecords<Item>('items', { where: { listId: projectId } }).sort(byDueThenCreated)
  const add = useAddItem(projectId)
  const { remove } = useCollection<List>('lists')
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
      <h2 className="to-tile__title">{project.data.name}</h2>
      <Progress value={done} max={Math.max(items.length, 1)} label={project.data.name} />
      <QuickAdd placeholder={t('tasks.placeholder')} onAdd={add} />
      {items.length === 0 ? <EmptyState title={t('project.empty')} /> : <ItemList items={items} />}
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

/* ------------------------------------------------------------------ *
 * Kanban
 * ------------------------------------------------------------------ */

export function KanbanScreen() {
  const t = useT()
  const items = useRecords<Item>('items')
  const projects = useRecords<List>('lists', { where: { kind: 'project' } })
  const names = useListNames()
  const actions = useItemActions()
  const add = useAddItem(null)

  return (
    <div className="to-stack">
      <QuickAdd placeholder={t('tasks.placeholder')} onAdd={add} />
      {projects.length > 0 && <p className="to-muted">{t('kanban.hint')}</p>}
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
                    {item.data.listId && names.get(item.data.listId)}
                    <TagList ids={item.tags} />
                  </span>
                  <div className="to-column__moves">
                    {index > 0 && (
                      <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('kanban.back')} onClick={() => void actions.move(item, STATUSES[index - 1])}>
                        <ChevronLeft size={14} />
                      </button>
                    )}
                    {index < STATUSES.length - 1 && (
                      <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('kanban.forward')} onClick={() => void actions.move(item, STATUSES[index + 1])}>
                        <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </section>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * One list per kind: Trabalho, Lar, Filmes e Séries
 * ------------------------------------------------------------------ */

function KindScreen({ kind }: { kind: ListKind }) {
  const t = useT()
  const lists = useRecords<List>('lists', { where: { kind } })
  const { create } = useCollection<List>('lists')
  const [selected] = lists
  const items = useRecords<Item>('items', { where: { listId: selected?.id ?? '__none__' } }).sort(byDueThenCreated)
  const addTo = useAddItem(selected?.id ?? null)
  const createItem = useCollection<Item>('items').create
  const createTag = useCreateTag()

  // The area's list is created on the first item, so an unused area stays empty.
  const add = async (text: string) => {
    if (selected) return addTo(text)
    const listId = await create({ name: t(`kind.${kind}`), kind, archived: false })
    const parsed = parseTask(text)
    const tagIds = await Promise.all(parsed.tags.map((name) => createTag(name)))
    await createItem(
      { listId, title: parsed.title, status: 'todo', done: false, due: parsed.due, priority: parsed.priority },
      tagIds,
    )
  }

  const open = items.filter((item) => !item.data.done)
  const done = items.filter((item) => item.data.done)

  return (
    <div className="to-stack">
      <QuickAdd placeholder={t(`kind.${kind}.placeholder`)} onAdd={add} />
      {items.length === 0 ? (
        <EmptyState title={t(`kind.${kind}.empty`)} body={t('kind.empty.body')} />
      ) : (
        <>
          <ItemList items={open} />
          {done.length > 0 && (
            <>
              <h2 className="to-section-title">{t(`kind.${kind}.done`)}</h2>
              <ItemList items={done} />
            </>
          )}
        </>
      )}
    </div>
  )
}

export const WorkScreen = () => <KindScreen kind="work" />
export const HomeScreen = () => <KindScreen kind="home" />
export const MediaScreen = () => <KindScreen kind="media" />

