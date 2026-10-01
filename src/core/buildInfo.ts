/** Public, non-sensitive identity for the Web bundle shown in diagnostics. */
export const WEB_VERSION = '0.1.0'

export interface BuildIdentity {
  version: string
  origin: string
}

export function currentBuildIdentity(location?: Pick<Location, 'host'>): BuildIdentity {
  return {
    version: WEB_VERSION,
    origin: location?.host ?? 'server',
  }
}

export function webBuildIdentity(): string {
  const identity = currentBuildIdentity(typeof window === 'undefined' ? undefined : window.location)
  return `${identity.version} · ${identity.origin}`
}
