import { createContext, useCallback, useContext, useEffect, useMemo, useState, createElement } from 'react'
import type { ReactNode } from 'react'
import { dictionaries, measurementUnits } from './messages'
import type { Dictionary, Language } from './messages'

export type { Language } from './messages'

const STORAGE_KEY = 'mhd.language'

function detectLanguage(): Language {
  if (typeof window === 'undefined') {
    return 'it'
  }

  // Italian is the product language for the current Web release. Keep the
  // dictionary architecture ready for future locales, but do not let a stale
  // browser preference switch the live UI to a partially translated locale.
  return 'it'
}

export interface I18nController {
  language: Language
  setLanguage: (language: Language) => void
  t: (key: string, replacements?: Record<string, string | number>) => string
  label: (prefix: string, rawValue: string) => string
  measurementLabel: (rawValue: string) => string
  measurementUnit: (rawValue: string) => string
  formatDate: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => string
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string
}

const fallbackDictionary = dictionaries.it
const I18nContext = createContext<I18nController | undefined>(undefined)

function interpolate(template: string, replacements?: Record<string, string | number>): string {
  if (!replacements) {
    return template
  }

  return Object.entries(replacements).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(String(value)),
    template,
  )
}

function humanizeRawValue(rawValue: string): string {
  const cleaned = rawValue.replace(/_/g, ' ').trim()
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

export function createI18nController(language: Language, setLanguage: (next: Language) => void): I18nController {
  const dictionary: Dictionary = dictionaries[language]
  const locale = language === 'it' ? 'it-IT' : 'en-US'

  const t = (key: string, replacements?: Record<string, string | number>): string => {
    const template = dictionary[key] ?? fallbackDictionary[key] ?? key
    return interpolate(template, replacements)
  }

  return {
    language,
    setLanguage,
    t,
    label: (prefix, rawValue) => t(`${prefix}.${rawValue}`) === `${prefix}.${rawValue}` ? humanizeRawValue(rawValue) : t(`${prefix}.${rawValue}`),
    measurementLabel: (rawValue) => t(`measurement.${rawValue}`) === `measurement.${rawValue}` ? humanizeRawValue(rawValue) : t(`measurement.${rawValue}`),
    measurementUnit: (rawValue) => measurementUnits[rawValue] ?? '',
    formatDate: (value, options) => {
      const date = value instanceof Date ? value : new Date(value)
      if (Number.isNaN(date.getTime())) {
        return String(value)
      }
      return new Intl.DateTimeFormat(locale, options ?? { dateStyle: 'medium' }).format(date)
    },
    formatNumber: (value, options) => new Intl.NumberFormat(locale, options).format(value),
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => detectLanguage())

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language
    }
  }, [language])

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Storage can be unavailable in private mode: the in-memory choice still applies.
    }
  }, [])

  const controller = useMemo(() => createI18nController(language, setLanguage), [language, setLanguage])

  return createElement(I18nContext.Provider, { value: controller }, children)
}

export function useI18n(): I18nController {
  const controller = useContext(I18nContext)
  if (!controller) {
    throw new Error('useI18n must be used inside I18nProvider')
  }
  return controller
}
