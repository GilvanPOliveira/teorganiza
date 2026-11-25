import type { FolderHandle } from '@core/storage/destinations'

/**
 * An in-memory folder shaped like the File System Access API, enough for
 * the disk adapter: nested folders, text files, async iteration, and a
 * permission that can be revoked to simulate a reload.
 */
export class FakeFolder implements FolderHandle {
  readonly folders = new Map<string, FakeFolder>()
  readonly files = new Map<string, string>()
  permission: 'granted' | 'prompt' | 'denied' = 'granted'
  /** What requestPermission answers. */
  answer: 'granted' | 'denied' = 'granted'
  writes = 0

  constructor(
    readonly name: string,
    private readonly parent: FakeFolder | null = null,
  ) {}

  private top(): FakeFolder {
    return this.parent ? this.parent.top() : this
  }

  private check(): void {
    if (this.top().permission !== 'granted') throw named('NotAllowedError')
  }

  async queryPermission() {
    return this.top().permission
  }

  async requestPermission() {
    const top = this.top()
    top.permission = top.answer
    return top.answer
  }

  async getDirectoryHandle(name: string, options: { create?: boolean } = {}): Promise<FakeFolder> {
    this.check()
    let folder = this.folders.get(name)
    if (!folder) {
      if (!options.create) throw named('NotFoundError')
      folder = new FakeFolder(name, this)
      this.folders.set(name, folder)
    }
    return folder
  }

  async getFileHandle(name: string, options: { create?: boolean } = {}) {
    this.check()
    if (!this.files.has(name)) {
      if (!options.create) throw named('NotFoundError')
      this.files.set(name, '')
    }
    return {
      getFile: async () => {
        this.check()
        const text = this.files.get(name)!
        return { text: async () => text }
      },
      createWritable: async () => {
        this.check()
        let buffer = ''
        return {
          write: async (data: string) => {
            buffer += data
          },
          // Like the browser: the file changes only when the stream closes.
          close: async () => {
            this.files.set(name, buffer)
            this.top().writes++
          },
        }
      },
    }
  }

  async *values(): AsyncIterable<{ kind: 'file' | 'directory'; name: string }> {
    this.check()
    for (const name of this.folders.keys()) yield { kind: 'directory', name }
    for (const name of this.files.keys()) yield { kind: 'file', name }
  }

  /** Reads a file by path, for assertions: "finance/transactions/2026-11.json". */
  read(path: string): string | undefined {
    const [first, ...rest] = path.split('/')
    if (rest.length === 0) return this.files.get(first)
    return this.folders.get(first)?.read(rest.join('/'))
  }
}

function named(name: string): Error {
  const error = new Error(name)
  error.name = name
  return error
}
