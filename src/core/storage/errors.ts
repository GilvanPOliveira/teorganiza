/**
 * Someone wrote first. Not a failure: it is the signal to pull, merge and
 * try again. The destination was left untouched.
 */
export class EtagMismatchError extends Error {
  constructor(
    readonly path: string,
    readonly expected: string | null,
    readonly actual: string | null,
  ) {
    super(`Etag mismatch on ${path}: expected ${expected ?? 'no file'}, found ${actual ?? 'no file'}`)
    this.name = 'EtagMismatchError'
  }
}

/**
 * Drive has no conditional write, so the etag check and the upload are two
 * requests. If another device wrote in between, our upload landed on top
 * of theirs. Detected after the fact by reading the revision history: their
 * version is still there as `overwritten`, never silently gone. The sync
 * engine must read it back and merge.
 */
export class ConcurrentWriteError extends Error {
  constructor(
    readonly path: string,
    readonly etag: string,
    readonly overwritten: string,
  ) {
    super(`Concurrent write on ${path}: revision ${overwritten} was written between check and upload`)
    this.name = 'ConcurrentWriteError'
  }
}

/**
 * The access token is gone or rejected. Sync aborts before any further
 * write, the local queue stays intact, and the user reconnects by gesture.
 */
export class AuthExpiredError extends Error {
  constructor() {
    super('Access token expired or revoked')
    this.name = 'AuthExpiredError'
  }
}

export class StorageRequestError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`Storage request failed with ${status}: ${body.slice(0, 200)}`)
    this.name = 'StorageRequestError'
  }
}
