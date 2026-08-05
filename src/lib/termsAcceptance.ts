const STORAGE_KEY = 'spotter.termsAccepted'

export function markTermsAccepted() {
  try {
    sessionStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // ignore quota / private mode
  }
}

export function consumeTermsAcceptedFlag(): boolean {
  try {
    if (sessionStorage.getItem(STORAGE_KEY) === '1') {
      sessionStorage.removeItem(STORAGE_KEY)
      return true
    }
  } catch {
    // ignore
  }
  return false
}
