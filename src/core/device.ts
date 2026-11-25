const DEVICE_ID_KEY = 'teorganiza.deviceId'
const DEVICE_NICKNAME_KEY = 'teorganiza.deviceNickname'

/**
 * The device id is the one piece of state that is genuinely local: it
 * identifies this browser or installation, never the user. It stays in
 * localStorage because it must NOT travel to another device in a backup.
 */
export function getDeviceId(): string {
  let id = safeGet(DEVICE_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    safeSet(DEVICE_ID_KEY, id)
  }
  return id
}

export function getDeviceNickname(): string {
  return safeGet(DEVICE_NICKNAME_KEY) ?? 'Este dispositivo'
}

export function setDeviceNickname(nickname: string): void {
  safeSet(DEVICE_NICKNAME_KEY, nickname)
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* private window, or storage disabled: a volatile id is still usable */
  }
}
