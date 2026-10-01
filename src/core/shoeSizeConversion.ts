/**
 * Indicative adult men's conversion based on Nike's published footwear chart.
 * Shoe sizing differs between brands; callers must keep converted values
 * editable and disclose that they are estimates.
 */
const NIKE_MENS_EU_SIZES: ReadonlyArray<readonly [eu: number, uk: string, us: string]> = [
  [35.5, '3', '3.5'], [36, '3.5', '4'], [36.5, '4', '4.5'], [37.5, '4.5', '5'],
  [38, '5', '5.5'], [38.5, '5.5', '6'], [39, '6', '6.5'], [40, '6', '7'],
  [40.5, '6.5', '7.5'], [41, '7', '8'], [42, '7.5', '8.5'], [42.5, '8', '9'],
  [43, '8.5', '9.5'], [44, '9', '10'], [44.5, '9.5', '10.5'], [45, '10', '11'],
  [45.5, '10.5', '11.5'], [46, '11', '12'], [47, '11.5', '12.5'], [47.5, '12', '13'],
  [48, '12.5', '13.5'], [48.5, '13', '14'], [49, '13.5', '14.5'],
]

export function convertEuShoeSize(value: string): { uk: string; us: string } | undefined {
  const eu = Number(value.trim().replace(',', '.'))
  if (!Number.isFinite(eu)) return undefined
  const match = NIKE_MENS_EU_SIZES.find(([size]) => size === eu)
  return match ? { uk: match[1], us: match[2] } : undefined
}

export function updateShoeSizeFromEu(
  eu: string,
  current: { uk: string; us: string; ukManual: boolean; usManual: boolean },
): { eu: string; uk: string; us: string; ukManual: boolean; usManual: boolean } {
  const equivalent = convertEuShoeSize(eu)
  return {
    eu,
    // Suggestions never overwrite user-owned values. Derived values update as
    // EU changes and can be replaced explicitly by the user when needed.
    uk: current.ukManual ? current.uk : equivalent?.uk ?? '',
    us: current.usManual ? current.us : equivalent?.us ?? '',
    ukManual: current.ukManual,
    usManual: current.usManual,
  }
}
