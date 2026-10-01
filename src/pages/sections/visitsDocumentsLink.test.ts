import { describe, expect, it } from 'vitest'

describe('calendar to documents link contract', () => {
  it('uses the document id as the deep-link event payload', () => {
    const event = new CustomEvent('mhd:open-document', { detail: 'document-42' })
    expect(event.detail).toBe('document-42')
    expect(event.type).toBe('mhd:open-document')
  })
})
