import { describe, expect, it } from 'vitest'
import { currentBuildIdentity, WEB_VERSION } from './buildInfo'

describe('build identity', () => {
  it('uses a stable public version and the serving host', () => {
    expect(currentBuildIdentity({ host: '127.0.0.1:8472' })).toEqual({
      version: WEB_VERSION,
      origin: '127.0.0.1:8472',
    })
  })

  it('has a deterministic server identity outside a browser', () => {
    expect(currentBuildIdentity()).toEqual({ version: WEB_VERSION, origin: 'server' })
  })
})
