import { describe, expect, it } from 'vitest'
import { parseHash, PRIMARY_TAB_IDS, routeToHash } from './router'

describe('web router', () => {
  it('exposes exactly the four canonical product tabs', () => {
    expect(PRIMARY_TAB_IDS).toEqual(['data', 'calendar', 'documents', 'settings'])
    expect(new Set(PRIMARY_TAB_IDS).size).toBe(4)
  })

  it('opens the unified data page by default', () => {
    expect(parseHash('')).toEqual({ tab: 'data' })
    expect(parseHash('#/dashboard')).toEqual({ tab: 'data' })
    expect(parseHash('#/modules')).toEqual({ tab: 'data' })
  })

  it('keeps legacy dashboard/module aliases out of the visible four-tab model', () => {
    expect(parseHash('#/dashboard')).toEqual({ tab: 'data' })
    expect(parseHash('#/modules')).toEqual({ tab: 'data' })
    expect(parseHash('#/documents')).toEqual({ tab: 'documents' })
    expect(parseHash('#/calendar')).toEqual({ tab: 'calendar' })
    expect(parseHash('#/settings')).toEqual({ tab: 'settings' })
  })

  it('converges supported legacy module links to their canonical destination', () => {
    expect(parseHash('#/modules/body')).toEqual({ tab: 'data', section: 'dolori' })
    expect(parseHash('#/modules/visits')).toEqual({ tab: 'calendar' })
    expect(parseHash('#/modules/documents')).toEqual({ tab: 'documents' })
    expect(parseHash('#/modules/bodyMeasurements')).toEqual({ tab: 'data', section: 'misure' })
  })

  it('redirects retired unified sections without losing the user intent', () => {
    expect(parseHash('#/data/diabete')).toEqual({ tab: 'data', section: 'analisi' })
    expect(parseHash('#/modules/diabetes')).toEqual({ tab: 'data', section: 'analisi' })
    expect(parseHash('#/data/respirazione')).toEqual({ tab: 'data', section: 'cuore' })
    expect(parseHash('#/data/documenti')).toEqual({ tab: 'documents' })
    expect(parseHash('#/data/visite')).toEqual({ tab: 'calendar' })
    expect(parseHash('#/data/diario')).toEqual({ tab: 'data', section: 'alimentazione' })
    expect(parseHash('#/data/idratazione')).toEqual({ tab: 'data', section: 'alimentazione' })
    expect(parseHash('#/modules/hydration')).toEqual({ tab: 'data', section: 'alimentazione' })
  })

  it('serializes unified section links predictably', () => {
    expect(routeToHash({ tab: 'data', section: 'farmaci' })).toBe('#/data/farmaci')
  })
})
