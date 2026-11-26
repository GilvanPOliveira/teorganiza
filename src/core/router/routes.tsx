import { createElement } from 'react'
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom'
import { getModules } from '@core/registry/registry'
import { ModuleScope } from '@core/runtime/module-context'
import { Dashboard } from '@core/shell/Dashboard'
import { Settings } from '@core/shell/Settings'
import { Shell } from '@core/shell/Shell'
import { TagPage, TagsPage } from '@core/shell/Tags'
import { Trash } from '@core/shell/Trash'

/**
 * Routes are built from the registry. A module declares relative paths and
 * never writes its own prefix, so renaming a module's id rewrites all of its
 * URLs without a single line inside it changing.
 */
export function buildRouter() {
  const moduleRoutes: RouteObject[] = getModules().flatMap((mod) =>
    mod.routes.map((route) => ({
      path: `${mod.id}/${route.path}`.replace(/\/$/, ''),
      element: (
        <ModuleScope moduleId={mod.id}>{createElement(route.element)}</ModuleScope>
      ),
    })),
  )

  return createBrowserRouter([
    {
      path: '/',
      element: <Shell />,
      children: [
        { index: true, element: <Dashboard /> },
        { path: 'settings', element: <Settings /> },
        { path: 'settings/trash', element: <Trash /> },
        { path: 'tags', element: <TagsPage /> },
        { path: 'review', element: <Navigate to="/?ver=semana" replace /> },
        // Old addresses, kept so saved links still land somewhere useful.
        { path: 'metrics', element: <Navigate to="/?ver=semana" replace /> },
        { path: 'previews/*', element: <Navigate to="/" replace /> },
        { path: 'tags/:tagId', element: <TagPage /> },
        ...moduleRoutes,
      ],
    },
  ])
}
