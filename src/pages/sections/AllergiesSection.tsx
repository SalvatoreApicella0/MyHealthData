import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { AlertTriangle, Plus, ShieldCheck } from 'lucide-react'
import { EntrySheet } from '../../components/EntrySheet'
import { eventSubsetSignature, eventsForTypes } from '../../core/eventSignatures'
import { fromDateTimeLocal, toDateTimeLocal } from '../../core/format'
import type { HealthEvent } from '../../core/types'
import { byDateDesc, buildEvent, editedEvent, excerpt, formatDay, hasTag, locale, nowInput, t, tagValue, type Loc } from './specialtyModel'
import { DateField, DeleteButton, EditButton, Empty, SheetActions, useEventDelete, useSheetSave } from './SpecialtyShared'
import type { SectionProps } from './SpecialtyShared'

/* -------------------------------- Allergie --------------------------------- */

const ALLERGY_CATEGORIES = ['Alimento', 'Farmaco', 'Polline', 'Animale', 'Lattice', 'Puntura', 'Contatto', 'Altro']
const ALLERGY_SEVERITIES = ['Lieve', 'Moderata', 'Grave', 'Anafilassi']

export function AllergiesSection({ data, language }: SectionProps) {
  const lang = locale(language)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<HealthEvent>()

  const allergySignature = eventSubsetSignature(data.events, ['allergy'])
  const records = useMemo(() => byDateDesc(eventsForTypes(data.events, ['allergy'])), [data.events, allergySignature])
  const anaphylaxis = records.some((record) => tagValue(record.tags, 'severity') === 'Anafilassi')

  const { deletingId, error: deleteError, remove } = useEventDelete((id) => data.deleteEvent(id), lang)

  return (
    <section className="spec" data-module="allergies">
      <header className="spec-head">
        <p className="spec-caption">
          <ShieldCheck aria-hidden="true" size={13} />
          {t(lang, `${records.length} allergeni`, `${records.length} allergens`)}
        </p>
        <button className="btn btn--ghost btn--small" onClick={() => { setEditing(undefined); setOpen(true) }} type="button">
          <Plus size={14} />
          {t(lang, 'Aggiungi', 'Add')}
        </button>
      </header>

      {anaphylaxis ? (
        <p className="spec-warning">
          <AlertTriangle aria-hidden="true" size={15} />
          {t(
            lang,
            'Piano di emergenza: porta con te l\u2019adrenalina prescritta e segui le indicazioni del medico.',
            'Emergency plan: carry your prescribed epinephrine and follow your doctor\u2019s instructions.',
          )}
        </p>
      ) : null}

      {deleteError ? <p aria-live="polite" className="spec-form__error" role="alert">{deleteError}</p> : null}

      {records.length === 0 ? (
        <Empty label={t(lang, 'Nessuna allergia registrata.', 'No allergies recorded.')} />
      ) : (
        <ul className="spec-list">
          {records.map((record) => {
            const category = tagValue(record.tags, 'category')
            const severity = tagValue(record.tags, 'severity')
            const symptoms = tagValue(record.tags, 'symptoms')
            const treatment = tagValue(record.tags, 'treatment')
            return (
              <li className="spec-row" key={record.id}>
                <span className="spec-row__main">
                  <span className="spec-row__titleline">
                    <span className="spec-row__title">{record.description}</span>
                    <span className="spec-row__date">{formatDay(record.occurredAt, lang)}</span>
                  </span>
                  <span className="spec-chips">
                    {category ? <span className="spec-chip">{category}</span> : null}
                    {severity ? <span className="spec-chip" data-severity={severity}>{severity}</span> : null}
                    {hasTag(record.tags, 'confirmed') ? (
                      <span className="spec-chip spec-chip--ok">
                        <ShieldCheck aria-hidden="true" size={11} />
                        {t(lang, 'Confermata', 'Confirmed')}
                      </span>
                    ) : null}
                    {hasTag(record.tags, 'epinephrine') ? (
                      <span className="spec-chip spec-chip--danger">
                        <AlertTriangle aria-hidden="true" size={11} />
                        {t(lang, 'Adrenalina', 'Epinephrine')}
                      </span>
                    ) : null}
                  </span>
                  {symptoms ? <span className="spec-row__note">{t(lang, 'Sintomi', 'Symptoms')}: {excerpt(symptoms)}</span> : null}
                  {treatment ? <span className="spec-row__note">{t(lang, 'Terapia', 'Treatment')}: {excerpt(treatment)}</span> : null}
                </span>
                <div className="spec-row__actions">
                  <EditButton label={`${t(lang, 'Modifica', 'Edit')}: ${record.description}`} onClick={() => { setEditing(record); setOpen(true) }} />
                  <DeleteButton disabled={deletingId !== null} label={t(lang, 'Elimina', 'Delete')} onClick={() => remove(record.id)} />
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {open ? (
        <EntrySheet onClose={() => setOpen(false)} title={editing ? t(lang, 'Modifica allergia', 'Edit allergy') : t(lang, 'Nuova allergia', 'New allergy')}>
          <AllergyForm existing={editing} language={lang} onClose={() => setOpen(false)} onSave={(event) => data.saveEvent(event)} />
        </EntrySheet>
      ) : null}
    </section>
  )
}

function AllergyForm({
  existing,
  language,
  onClose,
  onSave,
}: {
  existing?: HealthEvent
  language: Loc
  onClose: () => void
  onSave: (event: HealthEvent) => Promise<void>
}) {
  const [name, setName] = useState(existing?.description ?? '')
  const [category, setCategory] = useState(tagValue(existing?.tags ?? [], 'category') ?? (existing ? '' : ALLERGY_CATEGORIES[0] ?? 'Alimento'))
  const [severity, setSeverity] = useState(tagValue(existing?.tags ?? [], 'severity') ?? (existing ? '' : ALLERGY_SEVERITIES[1] ?? 'Moderata'))
  const [symptoms, setSymptoms] = useState(tagValue(existing?.tags ?? [], 'symptoms') ?? '')
  const [treatment, setTreatment] = useState(tagValue(existing?.tags ?? [], 'treatment') ?? '')
  const [confirmed, setConfirmed] = useState(hasTag(existing?.tags ?? [], 'confirmed'))
  const [epinephrine, setEpinephrine] = useState(hasTag(existing?.tags ?? [], 'epinephrine'))
  const [date, setDate] = useState(() => existing ? toDateTimeLocal(existing.occurredAt) : nowInput())
  const { error, save, saving } = useSheetSave(onSave, onClose, language)

  const submit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    if (!name.trim()) return
    const tags = [`category=${category}`, `severity=${severity}`, `symptoms=${symptoms}`, `treatment=${treatment}`]
    if (confirmed) tags.push('confirmed')
    if (epinephrine) tags.push('epinephrine')
    save(editedEvent(existing, buildEvent('allergy', fromDateTimeLocal(date), name.trim(), tags), ['category', 'severity', 'symptoms', 'treatment', 'confirmed', 'epinephrine']))
  }

  return (
    <form className="spec-form" onSubmit={submit}>
      <label>
        {t(language, 'Allergene', 'Allergen')}
        <input autoFocus onChange={(event) => setName(event.target.value)} placeholder={t(language, 'Nome dell\u2019allergene', 'Allergen name')} value={name} />
      </label>
      <div className="spec-form__grid">
        <label>
          {t(language, 'Categoria', 'Category')}
          <select onChange={(event) => setCategory(event.target.value)} value={category}>
            {!ALLERGY_CATEGORIES.includes(category) ? <option value={category}>{category || t(language, 'Non indicata', 'Not specified')}</option> : null}
            {ALLERGY_CATEGORIES.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <label>
          {t(language, 'Gravità', 'Severity')}
          <select onChange={(event) => setSeverity(event.target.value)} value={severity}>
            {!ALLERGY_SEVERITIES.includes(severity) ? <option value={severity}>{severity || t(language, 'Non indicata', 'Not specified')}</option> : null}
            {ALLERGY_SEVERITIES.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        {t(language, 'Sintomi', 'Symptoms')}
        <textarea onChange={(event) => setSymptoms(event.target.value)} rows={2} value={symptoms} />
      </label>
      <label>
        {t(language, 'Terapia o istruzioni', 'Treatment or instructions')}
        <textarea onChange={(event) => setTreatment(event.target.value)} rows={2} value={treatment} />
      </label>
      <DateField language={language} onChange={setDate} value={date} />
      <label className="spec-toggle">
        <input checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} type="checkbox" />
        {t(language, 'Confermata da un professionista', 'Confirmed by a professional')}
      </label>
      <label className="spec-toggle">
        <input checked={epinephrine} onChange={(event) => setEpinephrine(event.target.checked)} type="checkbox" />
        {t(language, 'Porto adrenalina prescritta', 'I carry prescribed epinephrine')}
      </label>
      <SheetActions error={error} label={t(language, 'Salva allergia', 'Save allergy')} language={language} onClose={onClose} saving={saving} />
    </form>
  )
}
