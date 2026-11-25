/**
 * Anything in the shell can open the command palette by dispatching this on
 * `window`; the shell owns the palette's state and listens for it.
 */
export const OPEN_PALETTE_EVENT = 'teorganiza:open-palette'

/** The modifier shown next to "K": ⌘ on Apple devices, Ctrl elsewhere. */
export const MOD_KEY = /Mac|iPhone|iPad/.test(globalThis.navigator?.userAgent ?? '') ? '⌘' : 'Ctrl'
