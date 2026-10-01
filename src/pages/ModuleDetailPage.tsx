import { useEffect, useState } from 'react'
import { ArrowLeft, Plus } from 'lucide-react'
import { getHealthModule, MEASUREMENT_MODULE_TYPES } from '../core/healthModules'
import type { HealthModuleId } from '../core/healthModules'
import type { EventType } from '../core/types'
import type { HealthDataController } from '../storage/useHealthData'
import { useI18n } from '../i18n'
import { VisionModuleView } from './VisionModuleView'
import {
  BackupModuleView,
  CANONICAL_CONFIGS,
  CanonicalDomainView,
  EventModuleView,
  MeasurementModuleView,
  ShareModuleView,
  TrendsModuleView,
} from './moduleViews'

interface ModuleDetailPageProps {
  moduleId: HealthModuleId
  data: HealthDataController
  onBack: () => void
}

const EVENT_TYPE_MODULES: Partial<Record<HealthModuleId, string>> = {
  allergies: 'allergy',
  vision: 'vision_prescription',
  gutHealth: 'digestive_health',
  dental: 'dental_care',
  sexualHealth: 'sexual_activity',
}

export function ModuleDetailPage({ moduleId, data, onBack }: ModuleDetailPageProps) {
  const { t } = useI18n()
  const module = getHealthModule(moduleId)
  const [addOpen, setAddOpen] = useState(false)

  const canonical = CANONICAL_CONFIGS[moduleId]
  const hasAddPanel = Boolean(module.measurementModule) || Boolean(EVENT_TYPE_MODULES[moduleId]) || Boolean(canonical)

  useEffect(() => {
    const open = (event: Event) => {
      const requested = (event as CustomEvent<unknown>).detail
      if (requested === undefined || requested === moduleId) setAddOpen(true)
    }
    window.addEventListener('mhd:open-add', open)
    return () => window.removeEventListener('mhd:open-add', open)
  }, [])

  useEffect(() => {
    if (addOpen) document.getElementById('module-add-record')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [addOpen])

  return (
    <section className="page-stack" data-add-open={addOpen}>
      <div className="module-toolbar">
        <button className="btn btn--ghost btn--small" onClick={onBack} type="button">
          <ArrowLeft size={16} />
          {t('nav.back')}
        </button>
        <div className="chip-row">
          {addOpen ? (
            <button className="btn btn--ghost btn--small" onClick={() => setAddOpen(false)} type="button">
              {t('common.close')}
            </button>
          ) : null}
          {hasAddPanel ? (
            <button className="btn btn--primary btn--small" onClick={() => setAddOpen((value) => !value)} type="button">
              <Plus size={15} />
              {t('common.add')}
            </button>
          ) : null}
        </div>
      </div>

      {module.measurementModule && moduleId !== 'sleep' && moduleId !== 'nutrition' ? (
        <MeasurementModuleView
          data={data}
          module={module}
          quickAddTypes={[module.measurementModule]}
          types={MEASUREMENT_MODULE_TYPES[module.measurementModule]}
        />
      ) : null}

      {moduleId === 'sleep' ? (
        <>
          <MeasurementModuleView data={data} module={module} types={['sleep_hours', 'mindful_minutes']} />
          {canonical ? <CanonicalDomainView config={canonical} data={data} module={module} /> : null}
        </>
      ) : null}

      {moduleId === 'nutrition' ? (
        <>
          <MeasurementModuleView
            data={data}
            module={module}
            types={[...MEASUREMENT_MODULE_TYPES.nutrition, 'dietary_water']}
          />
          {canonical ? <CanonicalDomainView config={canonical} data={data} module={module} /> : null}
        </>
      ) : null}

      {moduleId === 'medications' && canonical ? (
        <>
          <CanonicalDomainView config={canonical} data={data} module={module} />
          <CanonicalDomainView
            config={{
              key: 'medicationDoseEvents',
              dateField: 'recordedAt',
              titleFields: ['medicationName', 'medicationId'],
              detailFields: ['dose', 'unit', 'status'],
              icon: canonical.icon,
              tint: canonical.tint,
            }}
            data={data}
            module={module}
          />
        </>
      ) : null}

      {moduleId === 'trends' ? <TrendsModuleView data={data} module={module} /> : null}
      {moduleId === 'backupSync' ? <BackupModuleView data={data} /> : null}
      {moduleId === 'shareForCare' ? <ShareModuleView data={data} /> : null}

      {moduleId === 'vision' ? <VisionModuleView data={data} /> : null}

      {moduleId !== 'vision' && EVENT_TYPE_MODULES[moduleId] ? (
        <EventModuleView data={data} eventType={EVENT_TYPE_MODULES[moduleId] as EventType} module={module} />
      ) : null}

      {canonical &&
      moduleId !== 'sleep' &&
      moduleId !== 'nutrition' &&
      moduleId !== 'medications' ? (
        <CanonicalDomainView config={canonical} data={data} module={module} />
      ) : null}
    </section>
  )
}
