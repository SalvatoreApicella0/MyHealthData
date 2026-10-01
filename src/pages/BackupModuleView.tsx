import { FlaskConical } from 'lucide-react'
import { DataTransferPanel } from '../components/DataTransferPanel'
import type { HealthDataController } from '../storage/useHealthData'
import { useI18n } from '../i18n'

/* ----------------------------------------------------------------- backup */

export function BackupModuleView({ data }: { data: HealthDataController }) {
  const { language } = useI18n()
  return (
    <section className="page-stack">
      <div className="banner banner--info">
        <FlaskConical aria-hidden="true" size={18} />
        <span>
          {language === 'it'
            ? 'Il backup conserva profilo, eventi, misure, documenti e tutti i domini canonici iOS.'
            : 'The backup keeps profile, events, measurements, documents and every canonical iOS domain.'}
        </span>
      </div>
      <DataTransferPanel data={data} />
    </section>
  )
}
