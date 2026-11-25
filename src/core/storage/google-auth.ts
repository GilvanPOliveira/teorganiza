import { AuthExpiredError } from './errors'

const GIS_SRC = 'https://accounts.google.com/gsi/client'
/** The only scope. No `openid`, no `email`: the app does not need to know who you are. */
const SCOPE = 'https://www.googleapis.com/auth/drive.file'
/** Renew before this margin, so a sync never starts with a dying token. */
const EXPIRY_MARGIN_MS = 5 * 60 * 1000

interface TokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
}

interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void
}

interface GoogleOAuth2 {
  initTokenClient(config: {
    client_id: string
    scope: string
    callback: (response: TokenResponse) => void
    error_callback?: (error: { type: string }) => void
  }): TokenClient
  revoke(token: string, done?: () => void): void
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth2 } }
  }
}

/**
 * Google Identity Services, token model. No backend means no refresh
 * token — not a limitation to work around, the direct consequence of
 * having no server.
 *
 * The token lives only in this object's memory: never localStorage, never
 * IndexedDB. Every request goes through `getAccessToken`, which never
 * opens a popup by itself: GIS issues tokens through a popup, and a popup
 * without a user gesture is blocked. When the token is missing or about
 * to expire, it throws `AuthExpiredError`, sync aborts before writing,
 * and the "reconnect" button is the gesture that calls `connect`.
 */
export class GoogleAuth {
  private token: { value: string; expiresAt: number } | null = null
  private client: TokenClient | null = null
  private pending: { resolve: () => void; reject: (e: Error) => void } | null = null

  constructor(
    private readonly clientId: string,
    private readonly now: () => number = Date.now,
  ) {}

  get connected(): boolean {
    return this.token !== null && this.token.expiresAt - EXPIRY_MARGIN_MS > this.now()
  }

  /** Call only from a user gesture (a click). */
  async connect(): Promise<void> {
    const client = await this.tokenClient()
    await new Promise<void>((resolve, reject) => {
      this.pending = { resolve, reject }
      // '' reuses existing consent: the popup opens and closes by itself.
      client.requestAccessToken({ prompt: '' })
    })
  }

  async getAccessToken(): Promise<string> {
    if (!this.connected) throw new AuthExpiredError()
    return this.token!.value
  }

  /** "Sair": forgets the token. Local copy, base and destination stay. */
  signOut(): void {
    this.token = null
  }

  /** Revokes the grant at Google. The files on Drive are NOT deleted. */
  async revoke(): Promise<void> {
    const token = this.token?.value
    this.token = null
    if (!token) return
    const oauth2 = await loadGis()
    await new Promise<void>((resolve) => oauth2.revoke(token, resolve))
  }

  private async tokenClient(): Promise<TokenClient> {
    if (this.client) return this.client
    const oauth2 = await loadGis()
    this.client = oauth2.initTokenClient({
      client_id: this.clientId,
      scope: SCOPE,
      callback: (response) => {
        const pending = this.pending
        this.pending = null
        if (response.error || !response.access_token) {
          pending?.reject(new AuthExpiredError())
          return
        }
        this.token = {
          value: response.access_token,
          expiresAt: this.now() + (response.expires_in ?? 3600) * 1000,
        }
        pending?.resolve()
      },
      // Popup closed or blocked.
      error_callback: () => {
        const pending = this.pending
        this.pending = null
        pending?.reject(new AuthExpiredError())
      },
    })
    return this.client
  }
}

let gis: Promise<GoogleOAuth2> | null = null

function loadGis(): Promise<GoogleOAuth2> {
  gis ??= new Promise<GoogleOAuth2>((resolve, reject) => {
    const ready = () => {
      const oauth2 = window.google?.accounts?.oauth2
      if (oauth2) resolve(oauth2)
      else reject(new Error('Google Identity Services did not load'))
    }
    if (window.google?.accounts?.oauth2) return ready()
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.onload = ready
    script.onerror = () => {
      gis = null
      reject(new Error('Could not load Google Identity Services'))
    }
    document.head.appendChild(script)
  })
  return gis
}

/** Set at build time. Without it the Drive destination is not offered. */
export function googleClientId(): string | null {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
  return id && id.trim() ? id.trim() : null
}
