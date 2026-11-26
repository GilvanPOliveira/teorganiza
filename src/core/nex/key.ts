/**
 * The user's own Anthropic API key. It stays in this browser only: it is
 * never written to a collection, so sync never carries it anywhere.
 */
const STORAGE_KEY = 'teorganiza.nex.apiKey'

export function readNexKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveNexKey(key: string): void {
  try {
    if (key.trim()) localStorage.setItem(STORAGE_KEY, key.trim())
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Private windows can refuse storage; the panel then asks again.
  }
  window.dispatchEvent(new Event(NEX_KEY_EVENT))
}

export const NEX_KEY_EVENT = 'teorganiza:nex-key'

/** Asks the shell to open the Nex panel, optionally with a first question. */
export const OPEN_NEX_EVENT = 'teorganiza:open-nex'

export function openNex(prompt?: string): void {
  window.dispatchEvent(new CustomEvent(OPEN_NEX_EVENT, { detail: { prompt } }))
}
