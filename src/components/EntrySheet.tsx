import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { useI18n } from '../i18n'
import './entrySheet.css'

interface EntrySheetProps {
  title: string
  onClose: () => void
  children: ReactNode
}

/** Shared entry form: slides from the top, like the iOS sheets. */
export function EntrySheet({ title, onClose, children }: EntrySheetProps) {
  const { language } = useI18n()
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    const previousPaddingRight = document.body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`
    // Wait one frame so lazy form fields and autofocus controls have mounted.
    // Query inside the callback as well: the first render can contain only the
    // sheet shell while a specialist form is resolving.
    const focusFrame = window.requestAnimationFrame(() => {
      const firstField = Array.from(panel.current?.querySelector('.entry-sheet__body')?.querySelectorAll<HTMLElement>(
        'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? []).find((element) => !element.closest('[hidden], [inert]'))
      const target = firstField ?? closeButton.current
      target?.focus()
    })
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
      if (event.key !== 'Tab') return

      const focusable = Array.from(panel.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? []).filter((element) => !element.closest('[hidden], [inert]'))
      if (!focusable || focusable.length === 0) {
        event.preventDefault()
        closeButton.current?.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      window.cancelAnimationFrame(focusFrame)
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPaddingRight
      previousFocus?.focus()
    }
  }, [])

  return (
    <div className="entry-sheet" onMouseDown={onClose} role="presentation">
      <div
        aria-modal="true"
        aria-labelledby={titleId}
        className="entry-sheet__panel"
        onMouseDown={(event) => event.stopPropagation()}
        ref={panel}
        role="dialog"
      >
        <header className="entry-sheet__head">
          <h2 id={titleId}>{title}</h2>
          <button aria-label={language === 'en' ? 'Close' : 'Chiudi'} className="entry-sheet__close" onClick={onClose} ref={closeButton} type="button">
            <X size={16} />
          </button>
        </header>
        <div className="entry-sheet__body">{children}</div>
      </div>
    </div>
  )
}
