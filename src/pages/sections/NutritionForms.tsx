import type { FormEventHandler } from 'react'
import { EntrySheet } from '../../components/EntrySheet'
import {
  ACTIVITY_LEVELS,
  MEAL_GROUPS,
  SEX_OPTIONS,
  WEIGHT_GOALS,
} from './nutritionModel'
import type { Draft, NutritionPlan, SettingsDraft } from './nutritionModel'

export interface NutritionFormsProps {
  editing?: boolean
  draft: Draft
  error: string
  it: boolean
  numberFormat: Intl.NumberFormat
  open: boolean
  plan: NutritionPlan | undefined
  saving: boolean
  settings: SettingsDraft
  settingsError: string
  settingsOpen: boolean
  onCloseFood: () => void
  onCloseSettings: () => void
  onDraftChange: (key: keyof Draft, value: string) => void
  onFoodSubmit: FormEventHandler<HTMLFormElement>
  onSettingsChange: (key: keyof SettingsDraft, value: string) => void
  onSettingsSubmit: FormEventHandler<HTMLFormElement>
  t: (italian: string, english: string) => string
}

export function NutritionForms({
  editing,
  draft,
  error,
  it,
  numberFormat,
  open,
  plan,
  saving,
  settings,
  settingsError,
  settingsOpen,
  onCloseFood,
  onCloseSettings,
  onDraftChange,
  onFoodSubmit,
  onSettingsChange,
  onSettingsSubmit,
  t,
}: NutritionFormsProps) {
  return (
    <>
      {open ? (
        <EntrySheet onClose={onCloseFood} title={editing ? t('Modifica alimento', 'Edit food') : t('Aggiungi alimento', 'Add food')}>
          <form className="nutri-form" onSubmit={onFoodSubmit}>
            <div className="form-grid">
              <label>
                {t('Nome', 'Name')}
                <input autoFocus onChange={(event) => onDraftChange('name', event.target.value)} value={draft.name} />
              </label>
              <label>
                {t('Pasto', 'Meal')}
                <select onChange={(event) => onDraftChange('meal', event.target.value)} value={draft.meal}>
                  {MEAL_GROUPS.map((meal) => (
                    <option key={meal.value} value={meal.value}>{it ? meal.it : meal.en}</option>
                  ))}
                </select>
              </label>
              <label>
                {t('Quantità', 'Quantity')}
                <input inputMode="decimal" onChange={(event) => onDraftChange('quantity', event.target.value)} value={draft.quantity} />
              </label>
              <label>
                {t('Unità o porzione', 'Serving unit')}
                <input onChange={(event) => onDraftChange('servingUnit', event.target.value)} value={draft.servingUnit} />
              </label>
              <label>
                {t('Calorie (kcal)', 'Calories (kcal)')}
                <input inputMode="decimal" onChange={(event) => onDraftChange('calories', event.target.value)} value={draft.calories} />
              </label>
              <label>
                {t('Proteine (g)', 'Protein (g)')}
                <input inputMode="decimal" onChange={(event) => onDraftChange('protein', event.target.value)} value={draft.protein} />
              </label>
              <label>
                {t('Carboidrati (g)', 'Carbohydrates (g)')}
                <input inputMode="decimal" onChange={(event) => onDraftChange('carbohydrates', event.target.value)} value={draft.carbohydrates} />
              </label>
              <label>
                {t('Grassi (g)', 'Fat (g)')}
                <input inputMode="decimal" onChange={(event) => onDraftChange('fat', event.target.value)} value={draft.fat} />
              </label>
              <label>
                {t('Fibre (g)', 'Fiber (g)')}
                <input inputMode="decimal" onChange={(event) => onDraftChange('fiber', event.target.value)} value={draft.fiber} />
              </label>
              <label>
                {t('Zuccheri (g)', 'Sugar (g)')}
                <input inputMode="decimal" onChange={(event) => onDraftChange('sugar', event.target.value)} value={draft.sugar} />
              </label>
              <label>
                {t('Sodio (mg)', 'Sodium (mg)')}
                <input inputMode="decimal" onChange={(event) => onDraftChange('sodiumMilligrams', event.target.value)} value={draft.sodiumMilligrams} />
              </label>
              <label>
                {t('Nota', 'Note')}
                <input onChange={(event) => onDraftChange('note', event.target.value)} value={draft.note} />
              </label>
            </div>
            {error ? <p aria-live="polite" className="nutri-form__error" role="alert">{error}</p> : null}
            <div className="form-actions nutri-form__actions">
              <button className="btn btn--ghost btn--small" disabled={saving} onClick={onCloseFood} type="button">{t('Chiudi', 'Close')}</button>
              <button className="btn btn--primary btn--small" disabled={saving} type="submit">{saving ? t('Salvataggio…', 'Saving…') : editing ? t('Salva modifiche', 'Save changes') : t('Salva alimento', 'Save food')}</button>
            </div>
          </form>
        </EntrySheet>
      ) : null}

      {settingsOpen ? (
        <EntrySheet onClose={onCloseSettings} title={t('Impostazioni alimentazione', 'Nutrition settings')}>
          <form className="nutri-settings" onSubmit={onSettingsSubmit}>
            <div className="form-grid">
              <label>
                {t('Peso per il calcolo (kg)', 'Weight for calculation (kg)')}
                <input inputMode="decimal" onChange={(event) => onSettingsChange('weightKg', event.target.value)} value={settings.weightKg} />
              </label>
              <label>
                {t('Altezza (cm)', 'Height (cm)')}
                <input inputMode="decimal" onChange={(event) => onSettingsChange('heightCm', event.target.value)} value={settings.heightCm} />
              </label>
              <label>
                {t('Età', 'Age')}
                <input inputMode="numeric" onChange={(event) => onSettingsChange('age', event.target.value)} value={settings.age} />
              </label>
              <label>
                {t('Sesso biologico', 'Biological sex')}
                <select onChange={(event) => onSettingsChange('sex', event.target.value)} value={settings.sex}>
                  {SEX_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{it ? option.it : option.en}</option>
                  ))}
                </select>
              </label>
              <label>
                {t('Livello di attività', 'Activity level')}
                <select onChange={(event) => onSettingsChange('activity', event.target.value)} value={settings.activity}>
                  {ACTIVITY_LEVELS.map((level) => (
                    <option key={level.value} value={level.value}>{it ? level.it : level.en}</option>
                  ))}
                </select>
              </label>
              <label>
                {t('Obiettivo', 'Goal')}
                <select onChange={(event) => onSettingsChange('goal', event.target.value)} value={settings.goal}>
                  {WEIGHT_GOALS.map((goal) => (
                    <option key={goal.value} value={goal.value}>{it ? goal.it : goal.en}</option>
                  ))}
                </select>
              </label>
            </div>
            {plan ? (
              <dl className="nutri-settings__plan">
                <div><dt>{t('Metabolismo basale', 'Basal metabolism')}</dt><dd>{numberFormat.format(plan.bmr)} kcal</dd></div>
                <div><dt>{t('Mantenimento stimato', 'Estimated maintenance')}</dt><dd>{numberFormat.format(plan.tdee)} kcal</dd></div>
                <div><dt>{t('Obiettivo energetico', 'Energy goal')}</dt><dd>{numberFormat.format(plan.kcal)} kcal</dd></div>
                <div><dt>{t('Proteine', 'Protein')}</dt><dd>{numberFormat.format(plan.protein)} g</dd></div>
                <div><dt>{t('Carboidrati', 'Carbohydrates')}</dt><dd>{numberFormat.format(plan.carbohydrates)} g</dd></div>
                <div><dt>{t('Grassi', 'Fat')}</dt><dd>{numberFormat.format(plan.fat)} g</dd></div>
              </dl>
            ) : (
              <p className="nutri-settings__hint">{t('Inserisci peso, altezza ed età per calcolare gli obiettivi.', 'Enter weight, height and age to calculate goals.')}</p>
            )}
            {settingsError ? <p className="nutri-form__error">{settingsError}</p> : null}
            <div className="form-actions nutri-form__actions">
              <button className="btn btn--ghost btn--small" onClick={onCloseSettings} type="button">{t('Chiudi', 'Close')}</button>
              <button className="btn btn--primary btn--small" type="submit">{t('Salva obiettivi', 'Save goals')}</button>
            </div>
          </form>
        </EntrySheet>
      ) : null}
    </>
  )
}
