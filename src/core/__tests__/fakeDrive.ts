/**
 * In-memory stand-in for the slice of Drive REST v3 the adapter uses.
 * Behaves like Drive where the adapter depends on it: every upload is a new
 * revision, there is no conditional write, and nothing stops two files with
 * the same name in one folder.
 */

const FOLDER = 'application/vnd.google-apps.folder'

interface FakeFile {
  id: string
  name: string
  mimeType: string
  parent: string
  createdAt: number
  trashed: boolean
  revisions: { id: string; content: string }[]
}

export class FakeDrive {
  files = new Map<string, FakeFile>()
  token = 'valid'
  requests: string[] = []
  /** Responses to return instead of handling the next requests. */
  failNext: { status: number; body?: string }[] = []
  /** Runs right before an upload is applied — used to stage races. */
  beforeUpload: ((fileId: string | null, name: string) => void) | null = null

  private seq = 0

  fetch = async (input: string | URL | Request, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(String(input))
    const method = init.method ?? 'GET'
    this.requests.push(`${method} ${url.pathname}`)

    const injected = this.failNext.shift()
    if (injected) return new Response(injected.body ?? 'injected', { status: injected.status })

    const auth = (init.headers as Record<string, string>)?.Authorization
    if (auth !== `Bearer ${this.token}`) return json({ error: 'unauthorized' }, 401)

    const path = url.pathname
    let m: RegExpMatchArray | null

    if (method === 'GET' && path === '/drive/v3/files') return json({ files: this.query(url.searchParams.get('q')!) })

    if (method === 'POST' && path === '/drive/v3/files') {
      const meta = JSON.parse(String(init.body))
      return json(this.publicFile(this.add(meta.name, meta.mimeType, meta.parents[0])))
    }

    if (method === 'POST' && path === '/upload/drive/v3/files') {
      const [meta, content] = parseMultipart(String(init.body))
      this.beforeUpload?.(null, meta.name)
      const file = this.add(meta.name, meta.mimeType, meta.parents[0])
      this.revise(file, content)
      return json(this.publicFile(file))
    }

    if (method === 'PATCH' && (m = path.match(/^\/upload\/drive\/v3\/files\/([^/]+)$/))) {
      const file = this.files.get(m[1])!
      this.beforeUpload?.(file.id, file.name)
      this.revise(file, String(init.body))
      return json(this.publicFile(file))
    }

    if (method === 'GET' && (m = path.match(/^\/drive\/v3\/files\/([^/]+)\/revisions\/([^/]+)$/))) {
      const rev = this.files.get(m[1])?.revisions.find((r) => r.id === m![2])
      return rev ? new Response(rev.content, { status: 200 }) : json({ error: 'not found' }, 404)
    }

    if (method === 'GET' && (m = path.match(/^\/drive\/v3\/files\/([^/]+)\/revisions$/))) {
      return json({ revisions: this.files.get(m[1])!.revisions.map((r) => ({ id: r.id })) })
    }

    if (method === 'DELETE' && (m = path.match(/^\/drive\/v3\/files\/([^/]+)$/))) {
      this.files.delete(m[1])
      return new Response(null, { status: 204 })
    }

    return json({ error: `unhandled ${method} ${path}` }, 500)
  }

  // ── helpers for tests ──

  /** Path like "TeOrganiza/finance/transactions/2026-11.json". */
  byPath(path: string): FakeFile | undefined {
    let parent = 'root'
    let found: FakeFile | undefined
    for (const name of path.split('/')) {
      found = [...this.files.values()]
        .filter((f) => f.parent === parent && f.name === name && !f.trashed)
        .sort((a, b) => a.createdAt - b.createdAt)[0]
      if (!found) return undefined
      parent = found.id
    }
    return found
  }

  contentAt(path: string): unknown {
    const file = this.byPath(path)
    return file ? JSON.parse(file.revisions.at(-1)!.content) : undefined
  }

  /** Writes as another device would, straight to an existing file. */
  writeAs(path: string, content: unknown): string {
    const file = this.byPath(path)!
    return this.revise(file, JSON.stringify(content))
  }

  add(name: string, mimeType: string, parent: string): FakeFile {
    const file: FakeFile = {
      id: `f${++this.seq}`,
      name,
      mimeType: mimeType ?? 'application/octet-stream',
      parent,
      createdAt: this.seq,
      trashed: false,
      revisions: [],
    }
    this.files.set(file.id, file)
    return file
  }

  revise(file: FakeFile, content: string): string {
    const id = `r${++this.seq}`
    file.revisions.push({ id, content })
    return id
  }

  private publicFile(file: FakeFile) {
    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      ...(file.mimeType === FOLDER ? {} : { headRevisionId: file.revisions.at(-1)?.id }),
    }
  }

  /** Understands exactly the query shapes the adapter sends. */
  private query(q: string) {
    const name = q.match(/name = '((?:[^'\\]|\\.)*)'/)?.[1]?.replace(/\\(.)/g, '$1')
    const parent = q.match(/'([^']+)' in parents/)![1]
    const mime = q.match(/mimeType (=|!=) '([^']+)'/)
    return [...this.files.values()]
      .filter((f) => f.parent === parent && !f.trashed)
      .filter((f) => name === undefined || f.name === name)
      .filter((f) => !mime || (mime[1] === '=' ? f.mimeType === mime[2] : f.mimeType !== mime[2]))
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((f) => this.publicFile(f))
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function parseMultipart(body: string): [{ name: string; mimeType: string; parents: string[] }, string] {
  const boundary = body.slice(2, body.indexOf('\r\n'))
  const parts = body
    .split(`--${boundary}`)
    .slice(1, -1)
    .map((part) => part.slice(part.indexOf('\r\n\r\n') + 4, part.lastIndexOf('\r\n')))
  return [JSON.parse(parts[0]), parts[1]]
}
