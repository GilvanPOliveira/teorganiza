/**
 * Nex, the assistant, exists only as a place in the app for now: it does
 * not connect to any AI or API, and nothing leaves the browser. This is
 * how the shell is asked to show that place.
 */
export const OPEN_NEX_EVENT = 'teorganiza:open-nex'

export function openNex(): void {
  window.dispatchEvent(new Event(OPEN_NEX_EVENT))
}
