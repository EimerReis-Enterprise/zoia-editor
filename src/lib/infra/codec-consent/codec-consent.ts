const STORAGE_KEY = 'zoia-scope-hosted-codec-consent-v1'

export function hasHostedCodecConsent(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'accepted'
  } catch {
    return false
  }
}

export function acceptHostedCodecConsent(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, 'accepted')
  } catch {
    // Consent still applies to the current operation when browser storage is unavailable.
  }
}

export function requiresHostedCodec(file: File): boolean {
  return !file.name.toLowerCase().endsWith('.json')
}
