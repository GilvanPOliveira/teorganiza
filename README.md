# TeOrganiza

A local-first, modular personal dashboard. Your data stays in your own
storage — the project runs no server and holds nothing.

Finance, calendar, workouts, notes, goals: each one is a module. The core
gives modules a contract and gets out of the way, so new ones can be added
for years without the core changing.

> **Status: scaffold.** The core, the module contract and the shell are in
> place, with a minimal `finance` module proving the contract end to end.
> Storage destinations and sync are the next step — see the roadmap below.

## Why it is built this way

Three decisions shape everything else.

**No backend.** The app is a static page. Your data never passes through a
server belonging to this project, because there is no server belonging to
this project.

**Your storage is the destination.** A folder on your disk, or your own
Google Drive. The app keeps a local working copy and syncs to the
destination you choose — or to none at all, which is a perfectly valid way
to start.

**The core never knows a module by name.** Navigation, routes, database
tables and dashboard widgets are all derived from what modules declare.
Adding a module is one import and one line; it never touches `core/`.

## Running it

```bash
npm install
npm run dev
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Type check and production build |
| `npm test` | Core test suite |
| `npm run lint` | Lint, including the architectural boundary |

## Architecture

```
src/
  core/
    api/        the ONLY surface a module may import
    db/         Dexie working copy, envelope, repository
    registry/   module loading and validation
    router/     routes built from the registry
    runtime/    module scope, app context, event bus
    shell/      navigation, dashboard, settings
    storage/    destination adapter contract  (next step)
    sync/       three-way merge contract      (next step)
    i18n/
  modules/
    finance/    minimal, proves the contract
  modules.ts    the module list
  App.tsx       composition root — the only file that knows both sides
```

### The envelope

Every record in the system, from every module, lives in the same envelope.
It is what lets the core merge data it knows nothing about.

```ts
interface Envelope<T> {
  id: string            // UUID v7 — sortable, collision-free across devices
  createdAt: string
  updatedAt: string
  deletedAt: string | null   // tombstone
  deviceId: string
  rev: number
  schemaVersion: number
  data: T
}
```

Modules never build one: they pass `data` and the core does the rest. The
tombstone matters more than it looks — without it, deleting a record on one
device is resurrected by the next sync from another.

### The boundary

```
core/     must never import from modules/
modules/  may import from @core/api and nothing else in core/
modules/  must never import another module
```

This is checked by ESLint, not by convention, and CI fails on a violation.
It is the difference between a project people extend and a project people
fork and abandon.

If a module needs something `@core/api` does not expose, that is an issue
against the contract — never a shortcut around it.

## Writing a module

```ts
import { defineModule } from '@core/api'

export default defineModule({
  id: 'workouts',
  name: 'Workouts',
  apiVersion: 1,
  version: '0.1.0',
  collections: [{ name: 'sessions', schema, schemaVersion: 1, describe }],
  routes: [{ path: '', element: SessionList, label: 'Sessions' }],
  widgets: [{ id: 'streak', label: 'Streak', size: 'sm', element: Streak }],
  emits: ['session-logged'],
})
```

Then add one line to `src/modules.ts`. A community module is an npm package
that default-exports a `Module`; it never forks the core.

`describe` is the only place a module takes part in conflict resolution —
it turns a record into one readable line, and the merge itself stays in the
core.

### What `@core/api` deliberately does not expose

| Not exposed | Why |
| --- | --- |
| Raw Dexie | Replacing the local database would break every module |
| Storage adapters | Sync is the core's responsibility alone |
| Other modules' data | Integration happens through events |
| Network access | A module makes no requests |
| `localStorage` | Data outside the envelope never syncs and never migrates |

## Roadmap

- [x] Core, module contract, shell, routing, i18n
- [ ] Google Drive destination, with three-way merge and the device lease
- [ ] Full finance module
- [ ] Local folder destination (File System Access)
- [ ] Setup wizard for self-hosted instances
- [ ] Desktop build (Tauri), with signed updates
- [ ] Module template, contract docs, open the repository

## Contributing

Not open for contributions yet — the module contract should settle against
a second real module first. When it opens, the two channels will be
pull requests for official modules and standalone packages for community
ones. Neither requires a permanent fork.

## Licence

MIT.
