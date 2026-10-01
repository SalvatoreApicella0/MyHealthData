import { ProgressiveHistory } from '../../components/ProgressiveHistory'
import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Heart, Plus, ShieldCheck } from 'lucide-react'
import { EntrySheet } from '../../components/EntrySheet'
import { eventSubsetSignature, eventsForTypes } from '../../core/eventSignatures'
import { fromDateTimeLocal, toDateTimeLocal } from '../../core/format'
import type { EventType, HealthEvent } from '../../core/types'
import { byDateDesc, buildEvent, editedEvent, excerpt, formatDayTime, hasTag, locale, nowInput, partnerAlias, sexualTypeLabel, t, type Loc } from './specialtyModel'
import { DateField, DeleteButton, EditButton, Empty, SheetActions, useEventDelete, useSheetSave } from './SpecialtyShared'
import type { SectionProps } from './SpecialtyShared'

/* ----------------------------- Salute sessuale ----------------------------- */

export function SexualSection({ data, language }: SectionProps) {
  const lang = locale(language)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<HealthEvent>()

  const sexualSignature = eventSubsetSignature(data.events, ['sexual_activity', 'masturbation'])
  const events = useMemo(() => byDateDesc(eventsForTypes(data.events, ['sexual_activity', 'masturbation'])), [data.events, sexualSignature])
  const last30 = useMemo(() => {
    const since = Date.now() - 30 * 86_400_000
    return events.filter((event) => new Date(event.occurredAt).getTime() >= since)
  }, [events])

  const { masturbation, protectedCount, relationships } = useMemo(() => {
    let partner = 0
    let solo = 0
    let protectedEvents = 0
    for (const event of last30) {
      if (event.type === 'sexual_activity') partner += 1
      if (event.type === 'masturbation') solo += 1
      if (hasTag(event.tags, 'protected')) protectedEvents += 1
    }
    return { masturbation: solo, protectedCount: protectedEvents, relationships: partner }
  }, [last30])

  const { deletingId, error: deleteError, remove } = useEventDelete((id) => data.deleteEvent(id), lang)

  return (
    <section className="spec" data-module="sexual">
      <header className="spec-head">
        <p className="spec-caption">
          <Heart aria-hidden="true" size={13} />
          {t(lang, 'Ultimi 30 giorni', 'Last 30 days')}
        </p>
        <button className="btn btn--ghost btn--small" onClick={() => { setEditing(undefined); setOpen(true) }} type="button">
          <Plus size={14} />
          {t(lang, 'Registra', 'Record')}
        </button>
      </header>

      {deleteError ? <p aria-live="polite" className="spec-form__error" role="alert">{deleteError}</p> : null}

      <div className="spec-stats">
        <div className="spec-stat">
          <span className="spec-stat__value">{relationships}</span>
          <span className="spec-stat__label">{t(lang, 'Rapporti', 'Intercourse')}</span>
        </div>
        <div className="spec-stat">
          <span className="spec-stat__value">{masturbation}</span>
          <span className="spec-stat__label">{t(lang, 'Masturbazione', 'Masturbation')}</span>
        </div>
        <div className="spec-stat">
          <span className="spec-stat__value">{protectedCount}</span>
          <span className="spec-stat__label">{t(lang, 'Protetti', 'Protected')}</span>
        </div>
      </div>

      {events.length === 0 ? (
        <Empty label={t(lang, 'Nessuna attività registrata.', 'No activity recorded.')} />
      ) : (
        <ProgressiveHistory items={events} initialCount={4} language={language}>
          {(visible) => (
          <ul className="spec-list">
          {visible.map((event) => {
            const alias = partnerAlias(event)
            const contraception = hasTag(event.tags, 'contraception')
            const isProtected = hasTag(event.tags, 'protected')
            return (
              <li className="spec-row" key={event.id}>
                <span className="spec-row__main">
                  <span className="spec-row__titleline">
                    <span className="spec-row__title">{sexualTypeLabel(event.type, lang)}</span>
                    <span className="spec-row__date">{formatDayTime(event.occurredAt, lang)}</span>
                  </span>
                  <span className="spec-chips">
                    {isProtected ? (
                      <span className="spec-chip spec-chip--ok">
                        <ShieldCheck aria-hidden="true" size={11} />
                        {t(lang, 'Protetto', 'Protected')}
                      </span>
                    ) : null}
                    {contraception ? <span className="spec-chip">{t(lang, 'Contraccezione', 'Contraception')}</span> : null}
                    {alias ? <span className="spec-chip spec-chip--quiet">{t(lang, 'Partner', 'Partner')}: {alias}</span> : null}
                  </span>
                  {event.description ? <span className="spec-row__note">{excerpt(event.description)}</span> : null}
                </span>
                <div className="spec-row__actions">
                  <EditButton label={`${t(lang, 'Modifica', 'Edit')}: ${event.description}`} onClick={() => { setEditing(event); setOpen(true) }} />
                  <DeleteButton disabled={deletingId !== null} label={t(lang, 'Elimina', 'Delete')} onClick={() => remove(event.id)} />
                </div>
              </li>
            )
          })}
        </ul>
          )}
        </ProgressiveHistory>
      )}

      {open ? (
        <EntrySheet onClose={() => setOpen(false)} title={editing ? t(lang, 'Modifica attività', 'Edit activity') : t(lang, 'Registra attività', 'Record activity')}>
          <SexualForm existing={editing} language={lang} onClose={() => setOpen(false)} onSave={(event) => data.saveEvent(event)} />
        </EntrySheet>
      ) : null}
    </section>
  )
}

function SexualForm({
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
  const [type, setType] = useState<EventType>(existing?.type ?? 'sexual_activity')
  const [date, setDate] = useState(() => existing ? toDateTimeLocal(existing.occurredAt) : nowInput())
  const [alias, setAlias] = useState(existing ? partnerAlias(existing) ?? '' : '')
  const [isProtected, setIsProtected] = useState(hasTag(existing?.tags ?? [], 'protected'))
  const [contraception, setContraception] = useState(hasTag(existing?.tags ?? [], 'contraception'))
  const [note, setNote] = useState(existing?.description ?? '')
  const { error, save, saving } = useSheetSave(onSave, onClose, language)

  const submit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    const tags: string[] = []
    if (type === 'sexual_activity') {
      if (isProtected) tags.push('protected')
      if (contraception) tags.push('contraception')
      if (alias.trim()) tags.push(`partner:${alias.trim()}`)
    }
    save(editedEvent(existing, buildEvent(type, fromDateTimeLocal(date), note.trim() || sexualTypeLabel(type, language), tags), ['partner', 'protected', 'contraception']))
  }

  return (
    <form className="spec-form" onSubmit={submit}>
      <div className="spec-segmented" role="group">
        <button aria-pressed={type === 'sexual_activity'} onClick={() => setType('sexual_activity')} type="button">
          {t(language, 'Con partner', 'With partner')}
        </button>
        <button aria-pressed={type === 'masturbation'} onClick={() => setType('masturbation')} type="button">
          {t(language, 'Masturbazione', 'Masturbation')}
        </button>
      </div>

      <DateField language={language} onChange={setDate} value={date} />

      {type === 'sexual_activity' ? (
        <>
          <label>
            {t(language, 'Alias del partner', 'Partner alias')}
            <input onChange={(event) => setAlias(event.target.value)} placeholder={t(language, 'Opzionale', 'Optional')} value={alias} />
          </label>
          <label className="spec-toggle">
            <input checked={isProtected} onChange={(event) => setIsProtected(event.target.checked)} type="checkbox" />
            {t(language, 'Protezione barriera', 'Barrier protection')}
          </label>
          <label className="spec-toggle">
            <input checked={contraception} onChange={(event) => setContraception(event.target.checked)} type="checkbox" />
            {t(language, 'Contraccezione', 'Contraception')}
          </label>
        </>
      ) : null}

      <label>
        {t(language, 'Nota', 'Note')}
        <textarea onChange={(event) => setNote(event.target.value)} rows={2} value={note} />
      </label>
      <SheetActions error={error} label={t(language, 'Salva attività', 'Save activity')} language={language} onClose={onClose} saving={saving} />
    </form>
  )
}
