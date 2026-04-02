export const AUTH_USER_KEY = 'nexus_user'
export const AUTH_TOKEN_KEY = 'nexus_token'

export function getStoredToken(): string {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function setStoredToken(token: string) {
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token)
  } catch {
    // Ignore storage failures
  }
}

export function clearAuthStorage() {
  try {
    localStorage.removeItem(AUTH_USER_KEY)
    localStorage.removeItem(AUTH_TOKEN_KEY)
  } catch {
    // Ignore storage failures
  }
}
