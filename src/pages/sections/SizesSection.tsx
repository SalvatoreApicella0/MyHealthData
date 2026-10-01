import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Pencil, Ruler } from 'lucide-react'
import { EntrySheet } from '../../components/EntrySheet'
import type { Measurement } from '../../core/types'
import { convertEuShoeSize, updateShoeSizeFromEu } from '../../core/shoeSizeConversion'
import type { HealthDataController } from '../../storage/useHealthData'
import './sizesSection.css'

const SIZES_KEY = 'mhd.sizes'
const TOP_LADDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL']
const TROUSER_LADDER = ['44', '46', '48', '50', '52', '54', '56', '58', '60']
const STEP_KG = 7
const WARN_RATIO = 0.08

interface SizedValue {
  value: string
  weightKg?: number
  savedAt?: string
}

interface ShoeValue {
  eu?: string
  uk?: string
  us?: string
  ukManual?: boolean
  usManual?: boolean
  weightKg?: number
  savedAt?: string
}

interface StoredSizes {
  shoes?: ShoeValue
  top?: SizedValue
  trousers?: SizedValue
  jacket?: SizedValue
}

interface SizesDraft {
  eu: string
  uk: string
  us: string
  ukManual: boolean
  usManual: boolean
  top: string
  trousers: string
  jacket: string
}

function cleanString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function cleanNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return undefined
}

function objectRow(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined
}

function toSized(value: unknown): SizedValue | undefined {
  const row = objectRow(value)
  if (!row) return undefined
  const sized = cleanString(row.value)
  if (!sized) return undefined
  return { value: sized, weightKg: cleanNumber(row.weightKg), savedAt: cleanString(row.savedAt) }
}

function toShoes(value: unknown): ShoeValue | undefined {
  const row = objectRow(value)
  if (!row) return undefined
  const eu = cleanString(row.eu)
  const uk = cleanString(row.uk)
  const us = cleanString(row.us)
  if (!eu && !uk && !us) return undefined
  return {
    eu, uk, us,
    ukManual: typeof row.ukManual === 'boolean' ? row.ukManual : Boolean(uk),
    usManual: typeof row.usManual === 'boolean' ? row.usManual : Boolean(us),
    weightKg: cleanNumber(row.weightKg),
    savedAt: cleanString(row.savedAt),
  }
}

function readSizes(): StoredSizes {
  try {
    const raw = window.localStorage.getItem(SIZES_KEY)
    if (!raw) return {}
    const parsed = objectRow(JSON.parse(raw))
    if (!parsed) return {}
    return {
      shoes: toShoes(parsed.shoes),
      top: toSized(parsed.top),
      trousers: toSized(parsed.trousers),
      jacket: toSized(parsed.jacket),
    }
  } catch {
    return {}
  }
}

function writeSizes(value: StoredSizes): void {
  try {
    window.localStorage.setItem(SIZES_KEY, JSON.stringify(value))
  } catch {
    /* storage disabled: sizes only live in memory */
  }
}

function latestWeightKg(measurements: Measurement[]): number | undefined {
  let best: { time: number; kg: number } | undefined
  for (const measurement of measurements) {
    if (measurement.type !== 'weight') continue
    const time = new Date(measurement.measuredAt).getTime()
    const value = Number(measurement.value)
    if (Number.isNaN(time) || !Number.isFinite(value) || value <= 0) continue
    const kg = (measurement.unit ?? '').toLowerCase().includes('lb') ? value / 2.2046226218 : value
    if (!best || time > best.time) best = { time, kg }
  }
  return best?.kg
}

function ladderEstimate(ladder: string[], entry: SizedValue, currentKg: number | undefined): string | undefined {
  if (currentKg === undefined || entry.weightKg === undefined) return undefined
  const delta = currentKg - entry.weightKg
  if (delta < entry.weightKg * WARN_RATIO) return undefined
  const steps = Math.floor(delta / STEP_KG)
  if (steps < 1) return undefined
  const index = ladder.indexOf(entry.value)
  if (index < 0) return undefined
  const estimate = ladder[Math.min(index + steps, ladder.length - 1)]
  if (!estimate || estimate === entry.value) return undefined
  return estimate
}

export function SizesSection({ data, language }: { data: HealthDataController; language: string }) {
  const it = language !== 'en'
  const t = (itText: string, enText: string) => (it ? itText : enText)
  const [sizes, setSizes] = useState<StoredSizes>(() => readSizes())
  const [open, setOpen] = useState(false)
  const currentKg = useMemo(() => latestWeightKg(data.measurements), [data.measurements])

  const chips = useMemo(() => {
    const list: Array<{ id: string; label: string; value: string }> = []
    if (sizes.shoes) {
      const parts = [
        sizes.shoes.eu ? `EU ${sizes.shoes.eu}` : undefined,
        sizes.shoes.uk ? `UK ${sizes.shoes.uk}` : undefined,
        sizes.shoes.us ? `US ${sizes.shoes.us}` : undefined,
      ].filter((entry): entry is string => entry !== undefined)
      if (parts.length > 0) list.push({ id: 'shoes', label: t('Scarpe', 'Shoes'), value: parts.join(' · ') })
    }
    if (sizes.top) list.push({ id: 'top', label: t('Maglie', 'Tops'), value: sizes.top.value })
    if (sizes.trousers) list.push({ id: 'trousers', label: t('Pantaloni', 'Trousers'), value: sizes.trousers.value })
    if (sizes.jacket) list.push({ id: 'jacket', label: t('Giacca', 'Jacket'), value: sizes.jacket.value })
    return list
  }, [sizes, it])

  const hints = useMemo(() => {
    const list: Array<{ id: string; text: string }> = []
    const add = (id: string, ladder: string[], entry: SizedValue | undefined) => {
      if (!entry) return
      const estimate = ladderEstimate(ladder, entry, currentKg)
      if (!estimate) return
      list.push({
        id,
        text: t(
          `Stima: eri ${entry.value}, con il peso attuale potresti essere ${estimate}.`,
          `Estimate: you were ${entry.value}, at your current weight you might be ${estimate}.`,
        ),
      })
    }
    add('top', TOP_LADDER, sizes.top)
    add('trousers', TROUSER_LADDER, sizes.trousers)
    return list
  }, [sizes, currentKg, it])

  const save = (draft: SizesDraft) => {
    const now = new Date().toISOString()
    const current = sizes
    const eu = cleanString(draft.eu)
    const uk = cleanString(draft.uk)
    const us = cleanString(draft.us)
    const next: StoredSizes = {}
    if (eu || uk || us) {
      const previous = current.shoes
      const changed = eu !== previous?.eu || uk !== previous?.uk || us !== previous?.us
      next.shoes = {
        eu,
        uk,
        us,
        ukManual: draft.ukManual,
        usManual: draft.usManual,
        weightKg: changed ? currentKg : previous?.weightKg ?? currentKg,
        savedAt: changed ? now : previous?.savedAt ?? now,
      }
    }
    const assign = (key: 'top' | 'trousers' | 'jacket', raw: string) => {
      const value = cleanString(raw)
      if (!value) return
      const previous = current[key]
      const changed = !previous || previous.value !== value
      next[key] = {
        value,
        weightKg: changed ? currentKg : previous?.weightKg ?? currentKg,
        savedAt: changed ? now : previous?.savedAt ?? now,
      }
    }
    assign('top', draft.top)
    assign('trousers', draft.trousers)
    assign('jacket', draft.jacket)
    writeSizes(next)
    setSizes(next)
  }

  return (
    <section className="sizes">
      <header className="sizes-head">
        <p className="sizes-caption">
          <Ruler aria-hidden="true" size={13} />
          {t('Taglie e dimensioni', 'Sizes and measurements')}
        </p>
        <button className="btn btn--ghost btn--small" onClick={() => setOpen(true)} type="button">
          <Pencil size={14} />
          {t('Modifica taglie', 'Edit sizes')}
        </button>
      </header>

      {chips.length === 0 ? (
        <p className="sizes-empty">{t('Nessuna taglia salvata.', 'No sizes saved yet.')}</p>
      ) : (
        <div className="sizes-chips">
          {chips.map((chip) => (
            <span className="sizes-chip" key={chip.id}>
              <span className="sizes-chip__label">{chip.label}</span>
              <span className="sizes-chip__value" title={chip.value}>{chip.value}</span>
            </span>
          ))}
        </div>
      )}

      {hints.map((hint) => (
        <p className="sizes-hint" key={hint.id}>
          {hint.text}
        </p>
      ))}

      {open ? (
        <EntrySheet onClose={() => setOpen(false)} title={t('Modifica taglie', 'Edit sizes')}>
          <SizesForm
            initial={sizes}
            it={it}
            onClose={() => setOpen(false)}
            onSave={save}
          />
        </EntrySheet>
      ) : null}
    </section>
  )
}

function SizesForm({
  initial,
  it,
  onClose,
  onSave,
}: {
  initial: StoredSizes
  it: boolean
  onClose: () => void
  onSave: (draft: SizesDraft) => void
}) {
  const t = (itText: string, enText: string) => (it ? itText : enText)
  const [draft, setDraft] = useState<SizesDraft>({
    eu: initial.shoes?.eu ?? '',
    uk: initial.shoes?.uk ?? '',
    us: initial.shoes?.us ?? '',
    ukManual: initial.shoes?.ukManual ?? Boolean(initial.shoes?.uk),
    usManual: initial.shoes?.usManual ?? Boolean(initial.shoes?.us),
    top: initial.top?.value ?? '',
    trousers: initial.trousers?.value ?? '',
    jacket: initial.jacket?.value ?? '',
  })

  const set = (key: keyof SizesDraft, value: string) => {
    setDraft((current) => ({
      ...current,
      [key]: value,
      ...(key === 'uk' ? { ukManual: true } : {}),
      ...(key === 'us' ? { usManual: true } : {}),
    }))
  }

  const setEuShoeSize = (value: string) => {
    setDraft((current) => ({ ...current, ...updateShoeSizeFromEu(value, current) }))
  }

  const shoeSuggestion = convertEuShoeSize(draft.eu)
  const hasConflictingManualShoeSizes = Boolean(shoeSuggestion && (
    (draft.ukManual && draft.uk && draft.uk !== shoeSuggestion.uk)
    || (draft.usManual && draft.us && draft.us !== shoeSuggestion.us)
  ))

  const applyShoeSuggestion = () => {
    if (!shoeSuggestion) return
    setDraft((current) => ({
      ...current,
      uk: current.ukManual && current.uk === shoeSuggestion.uk ? current.uk : shoeSuggestion.uk,
      us: current.usManual && current.us === shoeSuggestion.us ? current.us : shoeSuggestion.us,
      ukManual: current.ukManual && current.uk === shoeSuggestion.uk,
      usManual: current.usManual && current.us === shoeSuggestion.us,
    }))
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSave(draft)
    onClose()
  }

  return (
    <form className="sizes-form" onSubmit={submit}>
      <fieldset className="sizes-form__group">
        <legend>{t('Scarpe', 'Shoes')}</legend>
        <div className="sizes-form__grid">
          <label>
            EU
            <input inputMode="decimal" onChange={(event) => setEuShoeSize(event.target.value)} value={draft.eu} />
          </label>
          <label>
            UK
            <input inputMode="decimal" onChange={(event) => set('uk', event.target.value)} value={draft.uk} />
          </label>
          <label>
            US
            <input inputMode="decimal" onChange={(event) => set('us', event.target.value)} value={draft.us} />
          </label>
        </div>
        {hasConflictingManualShoeSizes && shoeSuggestion ? (
          <div className="sizes-form__suggestion" role="status">
            <span>{t(`Stima uomo Nike: UK ${shoeSuggestion.uk} · US ${shoeSuggestion.us}.`, `Nike men's estimate: UK ${shoeSuggestion.uk} · US ${shoeSuggestion.us}.`)}</span>
            <button className="btn btn--ghost btn--small" onClick={applyShoeSuggestion} type="button">
              {t('Applica stima', 'Apply estimate')}
            </button>
          </div>
        ) : null}
      </fieldset>

      <div className="sizes-form__grid">
        <label>
          {t('Maglie (XS–3XL)', 'Tops (XS–3XL)')}
          <input onChange={(event) => set('top', event.target.value)} placeholder="M" value={draft.top} />
        </label>
        <label>
          {t('Pantaloni', 'Trousers')}
          <input onChange={(event) => set('trousers', event.target.value)} placeholder="48" value={draft.trousers} />
        </label>
        <label>
          {t('Giacca', 'Jacket')}
          <input onChange={(event) => set('jacket', event.target.value)} placeholder="50" value={draft.jacket} />
        </label>
      </div>

      <p className="sizes-form__hint">
        {t(
          'EU compila UK e US con una stima per uomo; la calzata varia per marca e i valori restano modificabili.',
          'EU suggests UK and US men’s sizes; fit varies by brand and the values remain editable.',
        )}
      </p>

      <p className="sizes-form__hint">
        {t(
          'Al salvataggio registriamo il peso attuale per stimare eventuali cambi di taglia.',
          'The current weight is recorded on save to estimate future size changes.',
        )}
      </p>

      <div className="sizes-form__actions">
        <button className="btn btn--ghost btn--small" onClick={onClose} type="button">
          {t('Annulla', 'Cancel')}
        </button>
        <button className="btn btn--primary btn--small" type="submit">
          {t('Salva taglie', 'Save sizes')}
        </button>
      </div>
    </form>
  )
}
