import { createContext, useContext, type ReactNode } from 'react'

const ModuleContext = createContext<string | null>(null)

/**
 * The shell wraps everything a module renders — its routes and its widgets —
 * in this provider. That is how a module's collections, events, settings and
 * translation keys get namespaced without the module ever passing its own id
 * around, and how one module is kept from addressing another's data.
 */
export function ModuleScope({ moduleId, children }: { moduleId: string; children: ReactNode }) {
  return <ModuleContext.Provider value={moduleId}>{children}</ModuleContext.Provider>
}

export function useModuleId(): string {
  const id = useContext(ModuleContext)
  if (!id) {
    throw new Error(
      '[TeOrganiza] This hook is only available inside a module. ' +
        'The shell provides the module scope when it renders a route or widget.',
    )
  }
  return id
}

/** For the shell itself, which legitimately works outside any module. */
export function useOptionalModuleId(): string | null {
  return useContext(ModuleContext)
}
