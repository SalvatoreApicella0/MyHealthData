import { useMemo, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { ChevronLeft, ChevronRight, Pencil, Plus, Settings, Star, Trash2 } from 'lucide-react'
import { createId } from '../../core/id'
import { snapshotRecords } from '../../core/healthModules'
import type { HealthDataController } from '../../storage/useHealthData'
import { hydrationSummary } from './hydrationAmounts'
import { HydrationSection } from './HydrationSection'
import {
  GOALS_KEY,
  MEAL_GROUPS,
  addDays,
  asNumber,
  asString,
  computePlan,
  emptyDraft,
  emptySettingsDraft,
  groupForMeal,
  macroShare,
  mealForGroup,
  monthGrid,
  parseEntry,
  recipeMacros,
  readGoals,
  sameDay,
  settingsDraftFor,
  startOfDay,
  startOfMonth,
} from './nutritionModel'
import type { Draft, FoodEntry, MealGroup, NutritionGoals, SettingsDraft } from './nutritionModel'
import { NutritionForms } from './NutritionForms'
import { EnergyRing, MacroRing } from './NutritionRings'
import './nutritionSection.css'

export function NutritionSection({ data, language }: { data: HealthDataController; language: string }) {
  const it = language !== 'en'
  const t = (itText: string, enText: string) => (it ? itText : enText)
  const numberFormat = useMemo(
    () => new Intl.NumberFormat(it ? 'it-IT' : 'en-US', { maximumFractionDigits: 1 }),
    [it],
  )
  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(it ? 'it-IT' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' }),
    [it],
  )
  const monthFormat = useMemo(
    () => new Intl.DateTimeFormat(it ? 'it-IT' : 'en-US', { month: 'long', year: 'numeric' }),
    [it],
  )

  const [editingEntry, setEditingEntry] = useState<FoodEntry>()
  const foodInFlight = useRef(false)
  const [selected, setSelected] = useState(() => startOfDay(new Date()))
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(() => emptyDraft())
  const [draftId, setDraftId] = useState(() => createId('foodLog'))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<SettingsDraft>(() => emptySettingsDraft())
  const [settingsError, setSettingsError] = useState('')
  const [goals, setGoals] = useState<NutritionGoals | undefined>(() => readGoals())
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()))
  const [entryAction, setEntryAction] = useState<string | null>(null)
  const [entryActionError, setEntryActionError] = useState<{ id: string; message: string } | null>(null)

  const today = startOfDay(new Date())
  const isToday = selected.getTime() === today.getTime()

  const entries = useMemo(() => {
    const snapshot = data as unknown as Record<string, unknown>
    return snapshotRecords(snapshot, 'foodLogEntries')
      .map(parseEntry)
      .filter((entry): entry is FoodEntry => entry !== undefined)
  }, [data.foodLogEntries])

  const recipes = useMemo(() => snapshotRecords(data as unknown as Record<string, unknown>, 'foodRecipes'), [data.foodRecipes])

  const dayEntries = useMemo(
    () => entries.filter((entry) => sameDay(entry.loggedAt, selected)).sort((left, right) => left.loggedAt - right.loggedAt),
    [entries, selected],
  )

  const totals = useMemo(() => {
    const sum = { calories: 0, protein: 0, carbohydrates: 0, fat: 0, fiber: 0 }
    for (const entry of dayEntries) {
      sum.calories += entry.calories
      sum.protein += entry.protein
      sum.carbohydrates += entry.carbohydrates
      sum.fat += entry.fat
      sum.fiber += entry.fiber ?? 0
    }
    return sum
  }, [dayEntries])

  const water = useMemo(() => ({ total: hydrationSummary(data.measurements, selected).waterToday, unit: 'mL' }), [data.measurements, selected])

  const byMeal = useMemo(() => {
    const grouped = new Map<MealGroup, FoodEntry[]>()
    for (const entry of dayEntries) {
      const group = groupForMeal(entry.meal)
      const list = grouped.get(group)
      if (list) list.push(entry)
      else grouped.set(group, [entry])
    }
    return grouped
  }, [dayEntries])

  const mealSummaries = useMemo(
    () => MEAL_GROUPS.map((meal) => {
      const items = byMeal.get(meal.value) ?? []
      return {
        meal,
        items,
        kcal: items.reduce((total, entry) => total + entry.calories, 0),
        protein: items.reduce((total, entry) => total + entry.protein, 0),
        carbohydrates: items.reduce((total, entry) => total + entry.carbohydrates, 0),
        fat: items.reduce((total, entry) => total + entry.fat, 0),
      }
    }),
    [byMeal],
  )

  const energy = useMemo(() => ({
    protein: totals.protein * 4,
    carbohydrates: totals.carbohydrates * 4,
    fat: totals.fat * 9,
  }), [totals])
  const energyTotal = energy.protein + energy.carbohydrates + energy.fat
  const macroRings = useMemo(() => [
    { key: 'protein', label: t('Proteine', 'Protein'), value: totals.protein, color: '#2EC794', goal: goals?.protein, share: macroShare(totals.protein, goals?.protein, energy.protein, energyTotal) },
    { key: 'carbohydrates', label: t('Carboidrati', 'Carbs'), value: totals.carbohydrates, color: '#F7AB45', goal: goals?.carbohydrates, share: macroShare(totals.carbohydrates, goals?.carbohydrates, energy.carbohydrates, energyTotal) },
    { key: 'fat', label: t('Grassi', 'Fat'), value: totals.fat, color: '#FA4F6E', goal: goals?.fat, share: macroShare(totals.fat, goals?.fat, energy.fat, energyTotal) },
  ], [energy, energyTotal, goals, it, totals])
  const kcalShare = useMemo(
    () => goals !== undefined && goals.kcal > 0 ? totals.calories / goals.kcal : 0,
    [goals, totals.calories],
  )

  const plan = useMemo(() => computePlan(settings), [settings])

  const setField = (key: keyof Draft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }) as Draft)
  }

  const setSettingsField = (key: keyof SettingsDraft, value: string) => {
    setSettings((current) => ({ ...current, [key]: value }) as SettingsDraft)
  }

  const openForm = (meal: MealGroup) => {
    setDraft((current) => editingEntry ? emptyDraft(meal) : ({ ...current, meal }))
    setEditingEntry(undefined)
    setDraftId(createId('foodLog'))
    setError('')
    setSaving(false)
    setOpen(true)
  }

  const editEntry = (entry: FoodEntry) => {
    const rawNumber = (key: string) => entry.raw[key] === undefined || entry.raw[key] === null ? '' : String(entry.raw[key])
    setDraft({ name: entry.name, meal: groupForMeal(entry.meal), quantity: rawNumber('quantity'), servingUnit: entry.servingUnit ?? '',
      calories: String(entry.calories), protein: rawNumber('protein'), carbohydrates: rawNumber('carbohydrates'), fat: rawNumber('fat'),
      fiber: rawNumber('fiber'), sugar: rawNumber('sugar'), sodiumMilligrams: rawNumber('sodiumMilligrams'), note: entry.note ?? '' })
    setEditingEntry(entry)
    setDraftId(entry.id)
    setError('')
    setOpen(true)
  }

  const openSettings = () => {
    setSettings(settingsDraftFor(data, goals))
    setSettingsError('')
    setSettingsOpen(true)
  }

  const saveSettings = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const computed = computePlan(settings)
    if (!computed) {
      setSettingsError(t('Inserisci peso, altezza ed età validi.', 'Enter valid weight, height and age.'))
      return
    }
    const next: NutritionGoals = {
      kcal: computed.kcal,
      protein: computed.protein,
      carbohydrates: computed.carbohydrates,
      fat: computed.fat,
      weightKg: computed.weightKg,
      updatedAt: new Date().toISOString(),
    }
    try {
      window.localStorage.setItem(GOALS_KEY, JSON.stringify(next))
    } catch (cause) {
      void cause
    }
    setGoals(next)
    setSettingsError('')
    setSettingsOpen(false)
  }

  const useRecipe = (recipe: Record<string, unknown>) => {
    setEditingEntry(undefined)
    const macros = recipeMacros(recipe)
    setDraft({
      name: asString(recipe.name) ?? '',
      meal: draft.meal,
      quantity: '1',
      servingUnit: t('porzione', 'serving'),
      calories: String(Math.round(macros.calories)),
      protein: String(Math.round(macros.protein * 10) / 10),
      carbohydrates: String(Math.round(macros.carbohydrates * 10) / 10),
      fat: String(Math.round(macros.fat * 10) / 10),
      fiber: '',
      sugar: '',
      sodiumMilligrams: '',
      note: '',
    })
    setDraftId(createId('foodLog'))
    setError('')
    setOpen(true)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving || foodInFlight.current) return
    const name = draft.name.trim()
    const calories = asNumber(draft.calories)
    if (!name || calories === undefined || calories <= 0) {
      setError(t('Inserisci nome e calorie.', 'Enter a name and calories.'))
      return
    }
    const numericFields: Array<keyof Draft> = ['quantity', 'protein', 'carbohydrates', 'fat', 'fiber', 'sugar', 'sodiumMilligrams']
    if (numericFields.some((key) => draft[key].trim() && (asNumber(draft[key]) === undefined || Number(draft[key].replace(',', '.')) < 0)) || (draft.quantity.trim() && asNumber(draft.quantity) === 0)) {
      setError(t('Controlla quantità e nutrienti: inserisci numeri validi, senza valori negativi.', 'Check quantity and nutrients: use valid numbers without negative values.'))
      return
    }
    const now = new Date()
    const loggedAt = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), now.getHours(), now.getMinutes(), now.getSeconds())
    const record: Record<string, unknown> = {
      ...editingEntry?.raw,
      id: draftId,
      name,
      meal: mealForGroup(draft.meal),
      quantity: asNumber(draft.quantity) ?? 1,
      servingUnit: draft.servingUnit.trim() || 'g',
      calories,
      protein: asNumber(draft.protein) ?? 0,
      carbohydrates: asNumber(draft.carbohydrates) ?? 0,
      fat: asNumber(draft.fat) ?? 0,
      loggedAt: editingEntry?.raw.loggedAt ?? loggedAt.toISOString(),
      isFavorite: editingEntry?.isFavorite ?? false,
      source: editingEntry?.raw.source ?? 'manual',
      updatedAt: now.toISOString(),
    }
    const fiber = asNumber(draft.fiber)
    record.fiber = fiber
    const sugar = asNumber(draft.sugar)
    record.sugar = sugar
    const sodium = asNumber(draft.sodiumMilligrams)
    record.sodiumMilligrams = sodium
    record.note = draft.note.trim() || undefined
    setError('')
    foodInFlight.current = true
    setSaving(true)
    try {
      await data.saveCanonicalRecord('foodLogEntries', record)
      setDraft(emptyDraft(draft.meal))
      setDraftId(createId('foodLog'))
      setEditingEntry(undefined)
      setOpen(false)
    } catch {
      setError(t('Impossibile salvare l’alimento. Riprova.', 'Could not save the food. Try again.'))
    } finally {
      foodInFlight.current = false
      setSaving(false)
    }
  }

  const removeEntry = async (entry: FoodEntry): Promise<void> => {
    if (entryAction !== null) return
    setEntryAction(`delete:${entry.id}`)
    setEntryActionError(null)
    try {
      await data.deleteCanonicalRecord('foodLogEntries', entry.id)
    } catch {
      setEntryActionError({ id: entry.id, message: t('Impossibile eliminare. Riprova.', 'Could not delete this entry. Try again.') })
    } finally {
      setEntryAction(null)
    }
  }

  const toggleFavorite = async (entry: FoodEntry): Promise<void> => {
    if (entryAction !== null) return
    setEntryAction(`favorite:${entry.id}`)
    setEntryActionError(null)
    try {
      await data.saveCanonicalRecord('foodLogEntries', { ...entry.raw, isFavorite: !entry.isFavorite })
    } catch {
      setEntryActionError({ id: entry.id, message: t('Impossibile aggiornare il preferito. Riprova.', 'Could not update the favorite. Try again.') })
    } finally {
      setEntryAction(null)
    }
  }

  const moveEntry = async (entry: FoodEntry, group: MealGroup): Promise<void> => {
    const meal = mealForGroup(group)
    if (meal === entry.meal || entryAction !== null) return
    setEntryAction(`move:${entry.id}`)
    setEntryActionError(null)
    try {
      await data.saveCanonicalRecord('foodLogEntries', { ...entry.raw, meal })
    } catch {
      setEntryActionError({ id: entry.id, message: t('Impossibile spostare il pasto. Riprova.', 'Could not move this meal. Try again.') })
    } finally {
      setEntryAction(null)
    }
  }

  const waterValue = water.total >= 1000 && water.unit.toLowerCase() === 'ml'
    ? `${numberFormat.format(water.total / 1000)} L`
    : `${numberFormat.format(water.total)} ${water.unit}`

  return (
    <section className="nutri">
      <div className="nutri-day">
        <button aria-label={t('Giorno precedente', 'Previous day')} className="nutri-day__nav" onClick={() => setSelected((current) => addDays(current, -1))} type="button">
          <ChevronLeft size={16} />
        </button>
        <button
          aria-expanded={calendarOpen}
          aria-label={t('Scegli data', 'Pick a date')}
          className="nutri-day__label nutri-day__label--button"
          onClick={() => {
            setCalendarMonth(startOfMonth(selected))
            setCalendarOpen((current) => !current)
          }}
          type="button"
        >
          {isToday ? `${t('Oggi', 'Today')}, ${dateFormat.format(selected)}` : dateFormat.format(selected)}
        </button>
        <button aria-label={t('Giorno successivo', 'Next day')} className="nutri-day__nav" disabled={isToday} onClick={() => setSelected((current) => addDays(current, 1))} type="button">
          <ChevronRight size={16} />
        </button>
        {!isToday ? (
          <button className="btn btn--ghost btn--small" onClick={() => { setSelected(today); setCalendarOpen(false) }} type="button">
            {t('Torna a oggi', 'Back to today')}
          </button>
        ) : null}
        {calendarOpen ? (
          <div className="nutri-cal" role="dialog">
            <div className="nutri-cal__head">
              <button
                aria-label={t('Mese precedente', 'Previous month')}
                className="nutri-cal__nav"
                onClick={() => setCalendarMonth((current) => startOfMonth(addDays(current, -1)))}
                type="button"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="nutri-cal__title">{monthFormat.format(calendarMonth)}</span>
              <button
                aria-label={t('Mese successivo', 'Next month')}
                className="nutri-cal__nav"
                onClick={() => setCalendarMonth((current) => startOfMonth(addDays(current, 32)))}
                type="button"
              >
                <ChevronRight size={15} />
              </button>
            </div>
            <div className="nutri-cal__grid">
              {(it ? ['L', 'M', 'M', 'G', 'V', 'S', 'D'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S']).map((weekday, index) => (
                <span className="nutri-cal__dow" key={`${weekday}-${index}`}>{weekday}</span>
              ))}
              {monthGrid(calendarMonth).map((day) => (
                <button
                  aria-pressed={sameDay(day.getTime(), selected)}
                  className="nutri-cal__day"
                  data-outside={day.getMonth() !== calendarMonth.getMonth() ? 'true' : undefined}
                  data-selected={sameDay(day.getTime(), selected) ? 'true' : undefined}
                  data-today={day.getTime() === today.getTime() ? 'true' : undefined}
                  key={day.toISOString()}
                  onClick={() => {
                    setSelected(startOfDay(day))
                    setCalendarOpen(false)
                  }}
                  type="button"
                >
                  {day.getDate()}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="panel nutri-summary">
        <div className="nutri-summary__head">
          <span className="nutri-summary__label">{t('Energia', 'Energy')}</span>
          <button aria-label={t('Impostazioni alimentazione', 'Nutrition settings')} className="nutri-iconbtn nutri-summary__gear" onClick={openSettings} type="button">
            <Settings size={15} />
          </button>
        </div>
        <div className="nutri-rings">
          <EnergyRing format={numberFormat} goal={goals?.kcal} goalLabel={t('di', 'of')} label={t('Energia', 'Energy')} share={kcalShare} value={totals.calories} />
          <div className="nutri-rings__macros">
            {macroRings.map((ring) => (
              <MacroRing color={ring.color} format={numberFormat} goal={ring.goal} key={ring.key} label={ring.label} share={ring.share} value={ring.value} />
            ))}
          </div>
        </div>
        {goals === undefined ? (
          <p className="nutri-summary__hint">{t('Imposta gli obiettivi dalle impostazioni per confrontare i consumi.', 'Set goals from the settings to compare your intake.')}</p>
        ) : null}
        {totals.fiber > 0 || water.total > 0 ? (
          <div className="nutri-summary__meta chip-row">
            {totals.fiber > 0 ? <span className="chip">{t('Fibre', 'Fiber')} {numberFormat.format(totals.fiber)} g</span> : null}
            {water.total > 0 ? <span className="chip">{t('Acqua', 'Water')} {waterValue}</span> : null}
          </div>
        ) : null}
      </div>

      <div className="nutri-head">
        <h3>{t('Pasti', 'Meals')}</h3>
        <button className="btn btn--ghost btn--small" onClick={() => openForm(draft.meal)} type="button">
          <Plus size={14} />
          {t('Aggiungi alimento', 'Add food')}
        </button>
      </div>

      <div className="nutri-meals">
        {mealSummaries.map(({ carbohydrates, fat, items, kcal, meal, protein }) => {
          return (
            <article className="nutri-meal" key={meal.value} style={{ '--tint': meal.color } as CSSProperties}>
              <header className="nutri-meal__head">
                <span className="nutri-meal__title">{it ? meal.it : meal.en}</span>
                <button aria-label={`${t('Aggiungi alimento', 'Add food')} · ${it ? meal.it : meal.en}`} className="nutri-iconbtn" onClick={() => openForm(meal.value)} type="button">
                  <Plus size={14} />
                </button>
              </header>
              <p className="nutri-meal__kpis">
                {items.length === 0
                  ? t('Nessun alimento', 'No food')
                  : `${numberFormat.format(Math.round(kcal))} kcal · P ${numberFormat.format(protein)} · C ${numberFormat.format(carbohydrates)} · ${it ? 'G' : 'F'} ${numberFormat.format(fat)}`}
              </p>
              {items.length > 0 ? (
                <ul className="nutri-entries">
                  {items.map((entry) => (
                    <li className="nutri-entry" key={entry.id}>
                      <button
                        aria-label={entry.isFavorite ? t('Rimuovi preferito', 'Remove favorite') : t('Segna preferito', 'Mark favorite')}
                        aria-pressed={entry.isFavorite}
                        className="nutri-entry__star"
                        data-active={entry.isFavorite}
                        disabled={entryAction !== null}
                        onClick={() => void toggleFavorite(entry)}
                        type="button"
                      >
                        <Star fill={entry.isFavorite ? 'currentColor' : 'none'} size={12} />
                      </button>
                      <button aria-label={`${t('Modifica alimento', 'Edit food')}: ${entry.name}`} className="nutri-entry__name nutri-entry__edit" onClick={() => editEntry(entry)} type="button">
                        {entry.name}<Pencil aria-hidden="true" size={12} />
                      </button>
                      <span className="nutri-entry__qty">
                        {entry.quantity !== undefined ? `${numberFormat.format(entry.quantity)} ` : ''}{entry.servingUnit ?? 'g'}
                      </span>
                      <span className="nutri-entry__kcal">{numberFormat.format(Math.round(entry.calories))} kcal</span>
                      <select
                        aria-label={t('Sposta in un altro pasto', 'Move to another meal')}
                        className="nutri-entry__move"
                        disabled={entryAction !== null}
                        onChange={(event) => void moveEntry(entry, event.target.value as MealGroup)}
                        value={groupForMeal(entry.meal)}
                      >
                        {MEAL_GROUPS.map((option) => (
                          <option key={option.value} value={option.value}>{it ? option.it : option.en}</option>
                        ))}
                      </select>
                      <button aria-label={t('Elimina', 'Delete')} className="nutri-iconbtn nutri-entry__delete" disabled={entryAction !== null} onClick={() => void removeEntry(entry)} type="button">
                        <Trash2 size={13} />
                      </button>
                      {entryActionError?.id === entry.id ? <span aria-live="polite" className="nutri-entry__error" role="alert">{entryActionError.message}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          )
        })}
      </div>

      <NutritionForms
        editing={Boolean(editingEntry)}
        draft={draft}
        error={error}
        it={it}
        numberFormat={numberFormat}
        onCloseFood={() => { if (!saving && !foodInFlight.current) setOpen(false) }}
        onCloseSettings={() => setSettingsOpen(false)}
        onDraftChange={setField}
        onFoodSubmit={(event) => void submit(event)}
        onSettingsChange={setSettingsField}
        onSettingsSubmit={saveSettings}
        open={open}
        plan={plan}
        saving={saving}
        settings={settings}
        settingsError={settingsError}
        settingsOpen={settingsOpen}
        t={t}
      />

      <div className="nutri-recipes">
        <h3>{t('Ricette', 'Recipes')}</h3>
        {recipes.length === 0 ? (
          <p className="empty-state">{t('Nessuna ricetta salvata.', 'No saved recipes.')}</p>
        ) : (
          <ul className="nutri-recipes__list">
            {recipes.map((recipe, index) => {
              const macros = recipeMacros(recipe)
              return (
                <li className="nutri-recipe" key={String(recipe.id ?? index)}>
                  <span className="nutri-recipe__name">{asString(recipe.name) ?? t('Ricetta', 'Recipe')}</span>
                  <span className="nutri-recipe__meta">{numberFormat.format(Math.round(macros.calories))} kcal {t('per porzione', 'per serving')}</span>
                  <button className="btn btn--ghost btn--small" onClick={() => useRecipe(recipe)} type="button">{t('Aggiungi', 'Add')}</button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="nutri-hydration">
        <h3>{t('Idratazione', 'Hydration')}</h3>
        <HydrationSection data={data} language={language} selectedDate={selected} />
      </div>
    </section>
  )
}
