import { describe, expect, it } from 'vitest'
import { convertEuShoeSize, updateShoeSizeFromEu } from './shoeSizeConversion'

describe('EU footwear size conversion', () => {
  it('suggests UK and US sizes for supported EU sizes', () => {
    expect(convertEuShoeSize('42')).toEqual({ uk: '7.5', us: '8.5' })
    expect(convertEuShoeSize('37,5')).toEqual({ uk: '4.5', us: '5' })
  })

  it('does not invent an equivalent for an unsupported size', () => {
    expect(convertEuShoeSize('41.5')).toBeUndefined()
    expect(convertEuShoeSize('')).toBeUndefined()
  })

  it('preserves manually entered equivalents when no suggestion exists', () => {
    expect(updateShoeSizeFromEu('41.5', { uk: '8', us: '9', ukManual: true, usManual: true })).toEqual({
      eu: '41.5', uk: '8', us: '9', ukManual: true, usManual: true,
    })
  })

  it('preserves manual values while refreshing generated suggestions', () => {
    expect(updateShoeSizeFromEu('42', { uk: 'manual', us: '7', ukManual: true, usManual: false })).toEqual({
      eu: '42', uk: 'manual', us: '8.5', ukManual: true, usManual: false,
    })
  })
})
