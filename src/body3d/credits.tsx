import { ExternalLink, X } from 'lucide-react'
import { useI18n } from '../i18n'

export function BodyCredits({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  return (
    <div className="body3d-credits" role="dialog" aria-label={t('body3d.credits')}>
      <div className="body3d-credits__header">
        <strong>{t('body3d.creditsTitle')}</strong>
        <button aria-label={t('common.close')} className="btn btn--icon btn--ghost" onClick={onClose} type="button">
          <X size={15} />
        </button>
      </div>
      <p>{t('body3d.creditsBody')}</p>
      <a href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html" rel="noreferrer" target="_blank">
        {t('body3d.creditsDataset')} <ExternalLink size={12} />
      </a>
      <a href="https://github.com/ashemag/human-atlas" rel="noreferrer" target="_blank">
        {t('body3d.creditsSource')} <ExternalLink size={12} />
      </a>
    </div>
  )
}
