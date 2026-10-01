import { DocumentsModuleView } from './DocumentsModuleView'
import type { HealthDataController } from '../storage/useHealthData'

interface DocumentsPageProps {
  data: HealthDataController
}

export function DocumentsPage({ data }: DocumentsPageProps) {
  return (
    <section className="page-stack">
      <DocumentsModuleView data={data} />
    </section>
  )
}
