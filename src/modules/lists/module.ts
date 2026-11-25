import { Briefcase, Clapperboard, FolderKanban, House, KanbanSquare, ListTodo } from 'lucide-react'
import { defineModule } from '@core/api'
import { itemSchema, listSchema, type Item, type List } from './schema'
import { HomeScreen, KanbanScreen, MediaScreen, ProjectScreen, ProjectsScreen, TasksScreen, WorkScreen } from './screens'
import { TodayTasks } from './widgets'
import ptBR from './locales/pt-BR.json'

/**
 * Items with a state, inside named lists. Six areas over the same two
 * collections: what changes between Tarefas, Projetos, Kanban, Trabalho,
 * Lar and Filmes e Séries is the view, not the shape of the data.
 */
export default defineModule({
  id: 'lists',
  name: 'Listas',
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
    { path: '', element: TasksScreen, area: { id: 'tasks', label: 'Tarefas', icon: ListTodo, order: 10, shortcut: 't' } },
    { path: 'projects', element: ProjectsScreen, area: { id: 'projects', label: 'Projetos', icon: FolderKanban, order: 20 } },
    { path: 'projects/:projectId', element: ProjectScreen },
    { path: 'kanban', element: KanbanScreen, area: { id: 'kanban', label: 'Kanban', icon: KanbanSquare, order: 30 } },
    { path: 'work', element: WorkScreen, area: { id: 'work', label: 'Trabalho', icon: Briefcase, order: 60 } },
    { path: 'home', element: HomeScreen, area: { id: 'home', label: 'Lar', icon: House, order: 80 } },
    { path: 'media', element: MediaScreen, area: { id: 'media', label: 'Filmes e Séries', icon: Clapperboard, order: 190 } },
  ],

  commands: [
    { id: 'new-task', label: 'Nova tarefa', path: '', keywords: ['tarefa', 'todo', 'fazer'] },
    { id: 'new-project', label: 'Novo projeto', path: 'projects', keywords: ['projeto'] },
  ],

  widgets: [{ id: 'today', label: 'Tarefas de hoje', size: 'sm', element: TodayTasks }],

  locales: { 'pt-BR': ptBR },
})
