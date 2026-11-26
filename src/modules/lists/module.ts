import { FolderKanban, ListTodo } from 'lucide-react'
import { defineModule } from '@core/api'
import { itemSchema, listSchema, type Item, type List } from './schema'
import { HomeScreen, KanbanRedirect, MediaRedirect, ProjectScreen, ProjectsScreen, TasksScreen, WorkScreen } from './screens'
import { TodayTasks } from './widgets'
import ptBR from './locales/pt-BR.json'

/**
 * Items with a state, inside named lists. Six areas over the same two
 * collections: what changes between Tarefas, Projetos, Kanban, Trabalho,
 * Lar and Filmes e Séries is the view, not the shape of the data.
 */
export default defineModule({
  id: 'lists',
  name: 'Tarefas e projetos',
  apiVersion: 1,
  version: '0.1.0',
  icon: ListTodo,

  collections: [
    {
      name: 'lists',
      schema: listSchema,
      schemaVersion: 1,
      describe: (record) => (record.data as List).name,
      indexes: ['kind'],
    },
    {
      name: 'items',
      schema: itemSchema,
      schemaVersion: 1,
      describe: (record) => (record.data as Item).title,
      indexes: ['listId', 'done', 'due'],
    },
  ],

  routes: [
    { path: '', element: TasksScreen, area: { id: 'tasks', label: 'Tarefas', icon: ListTodo, order: 10, shortcut: 't', tabLabel: 'Tarefas' } },
    { path: 'projects', element: ProjectsScreen, area: { id: 'projects', label: 'Projetos', icon: FolderKanban, order: 20 } },
    { path: 'projects/:projectId', element: ProjectScreen },
    // The board now lives inside each project; the old address goes to the list.
    { path: 'kanban', element: KanbanRedirect },
    // Trabalho and Lar are the switch inside Tarefas; each keeps its address.
    { path: 'work', element: WorkScreen },
    { path: 'home', element: HomeScreen },
    { path: 'media', element: MediaRedirect },
  ],

  commands: [
    { id: 'new-task', label: 'Nova tarefa', path: '', keywords: ['tarefa', 'todo', 'fazer'] },
    { id: 'new-project', label: 'Novo projeto', path: 'projects', keywords: ['projeto'] },
  ],

  widgets: [{ id: 'today', label: 'Tarefas de hoje', size: 'sm', element: TodayTasks }],

  provides: {
    /** Tasks with a date, and project deadlines: what the agenda and the day summary show. */
    dated: async (read, { from, to }) => {
      const lists = await read<List>('lists')
      const projects = new Map(lists.filter((l) => l.data.kind === 'project').map((l) => [l.id, l]))
      const items = await read<Item>('items')
      return [
        ...items
          .filter((item) => item.data.due && item.data.due >= from && item.data.due <= to)
          .map((item) => {
            const project = item.data.listId ? projects.get(item.data.listId) : undefined
            return {
              id: item.id,
              date: item.data.due!,
              title: project ? `${item.data.title} · ${project.data.name}` : item.data.title,
              kind: 'Tarefa',
              path: project ? `projects/${project.id}` : '',
              done: item.data.done,
            }
          }),
        ...[...projects.values()]
          .filter((p) => !p.data.archived && p.data.due && p.data.due >= from && p.data.due <= to)
          .map((p) => ({ id: p.id, date: p.data.due!, title: p.data.name, kind: 'Prazo do projeto', path: `projects/${p.id}` })),
      ]
    },
    /** Each project's share of tasks done: what a goal can follow. */
    progress: async (read) => {
      const lists = await read<List>('lists')
      const items = await read<Item>('items')
      return lists
        .filter((l) => l.data.kind === 'project' && !l.data.archived)
        .map((project) => {
          const mine = items.filter((item) => item.data.listId === project.id)
          return {
            id: project.id,
            label: project.data.name,
            done: mine.filter((item) => item.data.done).length,
            total: mine.length,
            path: `projects/${project.id}`,
            due: project.data.due ?? null,
          }
        })
    },
  },

  locales: { 'pt-BR': ptBR },
})
