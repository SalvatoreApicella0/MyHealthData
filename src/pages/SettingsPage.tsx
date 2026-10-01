import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  HardDriveDownload,
  Languages,
  Lock,
  ShieldCheck,
  Smartphone,
  User,
} from 'lucide-react'
import { DataTransferPanel } from '../components/DataTransferPanel'
import type { HealthDataController } from '../storage/useHealthData'
import { useI18n } from '../i18n'
import type { ThemePreference } from '../theme'
import {
  AboutSection,
  DevicesSection,
  ModulesSection,
  PrivacySection,
  ProfileSection,
  ReportSection,
} from './SettingsSections'

interface SettingsPageProps {
  data: HealthDataController
  section?: string
  onOpenSection: (section: string) => void
  theme: ThemePreference
  setTheme: (theme: ThemePreference) => void
}

const SECTIONS = ['profile', 'modules', 'data', 'devices', 'privacy', 'report', 'about'] as const

export function SettingsPage({
  data,
  section,
  onOpenSection,
  theme,
  setTheme,
}: SettingsPageProps) {
  const { t, language } = useI18n()
  const activeSection = SECTIONS.includes(section as (typeof SECTIONS)[number]) ? (section as (typeof SECTIONS)[number]) : undefined

  const rows: Array<{ id: (typeof SECTIONS)[number]; icon: typeof User; title: string }> = [
    { id: 'profile', icon: User, title: t('settings.profile') },
    { id: 'modules', icon: Languages, title: t('common.language') },
    { id: 'data', icon: HardDriveDownload, title: t('settings.data') },
    { id: 'devices', icon: Smartphone, title: t('settings.devices') },
    { id: 'privacy', icon: ShieldCheck, title: t('settings.privacy') },
    { id: 'report', icon: BookOpen, title: t('settings.report') },
    { id: 'about', icon: Lock, title: t('settings.about') },
  ]

  const descriptions: Record<string, string> = language === 'it' ? {
    profile: 'Informazioni personali e contatti', modules: 'Italiano o inglese',
    data: 'Salva una copia dei dati, importa o esporta il vault', devices: 'Collega e gestisci i dispositivi',
    privacy: 'Archiviazione locale e protezione dei dati', report: 'Prepara un riepilogo dei dati', about: 'Versione e informazioni sull’app',
  } : {
    profile: 'Personal information and contacts', modules: 'Italian or English',
    data: 'Back up, import or export your vault', devices: 'Connect and manage devices',
    privacy: 'Local storage and data protection', report: 'Prepare a data summary', about: 'App version and information',
  }

  return (
    <section className="page-stack">
      {activeSection ? (
        <div className="settings-section-head">
          <button className="btn btn--ghost btn--small" onClick={() => onOpenSection('')} type="button">
            <ArrowLeft size={16} />
            {t('nav.back')}
          </button>
          <h1>{rows.find((row) => row.id === activeSection)?.title ?? t('settings.title')}</h1>
        </div>
      ) : null}

      {!activeSection ? (
        <>
          <section className="panel">
            <div className="panel__header settings-appearance">
              <div>
                <h2>{language === 'it' ? 'Aspetto' : 'Appearance'}</h2>
                <p>
                  {language === 'it'
                    ? 'Segui l’aspetto del dispositivo o scegli una modalità.'
                    : 'Follow your device appearance or choose a mode.'}
                </p>
              </div>
              <div aria-label={language === 'it' ? 'Aspetto' : 'Appearance'} className="segmented" role="group">
                {(['system', 'light', 'dark'] as ThemePreference[]).map((option) => (
                  <button aria-pressed={theme === option} key={option} onClick={() => setTheme(option)} type="button">
                    {option === 'system'
                      ? language === 'it'
                        ? 'Sistema'
                        : 'System'
                      : option === 'light'
                        ? language === 'it'
                          ? 'Chiaro'
                          : 'Light'
                        : language === 'it'
                          ? 'Scuro'
                          : 'Dark'}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <div className="settings-list">
            {rows.map((row) => {
              const Icon = row.icon
              return (
                <button className="settings-row" key={row.id} onClick={() => onOpenSection(row.id)} type="button">
                  <span aria-hidden="true" className="icon-orb">
                    <Icon size={18} />
                  </span>
                  <span className="row__main">
                    <span className="row__title">{row.title}</span>
                    <span className="row__detail">{descriptions[row.id]}</span>
                  </span>
                  <ChevronRight aria-hidden="true" size={18} />
                </button>
              )
            })}
          </div>
        </>
      ) : null}

      {activeSection === 'profile' ? <ProfileSection data={data} /> : null}
      {activeSection === 'modules' ? <ModulesSection /> : null}
      {activeSection === 'data' ? <DataTransferPanel data={data} /> : null}
      {activeSection === 'devices' ? <DevicesSection /> : null}
      {activeSection === 'privacy' ? <PrivacySection /> : null}
      {activeSection === 'report' ? <ReportSection data={data} /> : null}
      {activeSection === 'about' ? <AboutSection /> : null}
    </section>
  )
}
