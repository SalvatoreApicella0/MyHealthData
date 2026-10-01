import { useState } from 'react'
import type { ReactNode } from 'react'

/** A compact history with a reachable path to every record. */
export function ProgressiveHistory<T>({ items, initialCount = 5, language, children }: {
  items: readonly T[]
  initialCount?: number
  language: string
  children: (visible: readonly T[]) => ReactNode
}) {
  const [limit, setLimit] = useState(initialCount)
  const count = Math.min(limit, items.length)
  const remaining = items.length - count
  const it = language === 'it'
  return (
    <>
      {children(items.slice(0, count))}
      {items.length > initialCount ? (
        <div className="history-controls">
          <span aria-live="polite" role="status">{it ? `${count} di ${items.length} registrazioni` : `${count} of ${items.length} entries`}</span>
          <button className="btn btn--ghost btn--small" disabled={remaining === 0} onClick={() => setLimit((value) => value + initialCount)} type="button">
            {remaining > 0
              ? (it ? `Mostra altre ${Math.min(initialCount, remaining)}` : `Show ${Math.min(initialCount, remaining)} more`)
              : (it ? 'Tutte le registrazioni visibili' : 'All entries shown')}
          </button>
        </div>
      ) : null}
    </>
  )
}
