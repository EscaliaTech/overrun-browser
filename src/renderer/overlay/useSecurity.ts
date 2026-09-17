import { useEffect, useRef, useState } from 'react'
import type { OverrunEvent, SecurityRecord, SecurityState } from '../../shared/events'

export interface SecurityView {
  state: SecurityState
  /** Peticiones pausadas esperando decisión, en orden de llegada. */
  queue: SecurityRecord[]
  /** Timeline de auditoría: toda acción con motivo, regla y timestamp (fase 2.0). */
  audit: (SecurityRecord & { ts: number })[]
  clear: () => void
}

const MAX_AUDIT = 1000
const IDLE: SecurityState = { enabled: false, pending: 0, timeoutMs: 15_000, maxPending: 50, rules: [] }

/**
 * Dominio security del bus. La cola y la auditoría se derivan de los eventos:
 * el main sigue siendo la única fuente de verdad del estado de interceptación.
 */
export function useSecurity(): SecurityView {
  const queue = useRef<SecurityRecord[]>([])
  const audit = useRef<(SecurityRecord & { ts: number })[]>([])
  const dirty = useRef(false)

  const clear = (): void => {
    audit.current = []
    dirty.current = true
  }

  const [view, setView] = useState<SecurityView>({ state: IDLE, queue: [], audit: [], clear })

  useEffect(() => {
    const offState = window.overrun.onSecurityState((state) =>
      setView((prev) => ({ ...prev, state })))

    const offEvent = window.overrun.onEvent((evt: OverrunEvent) => {
      if (evt.domain !== 'security') return
      const record = evt.record
      if (record.phase === 'intercepted') queue.current.push(record)
      else queue.current = queue.current.filter((r) => r.id !== record.id)
      audit.current.push({ ...record, ts: evt.ts })
      if (audit.current.length > MAX_AUDIT) audit.current.splice(0, audit.current.length - MAX_AUDIT)
      dirty.current = true
    })

    let raf = 0
    const flush = (): void => {
      raf = requestAnimationFrame(flush)
      if (!dirty.current) return
      dirty.current = false
      setView((prev) => ({ ...prev, queue: queue.current.slice(), audit: audit.current.slice(), clear }))
    }
    raf = requestAnimationFrame(flush)

    return () => {
      offState()
      offEvent()
      cancelAnimationFrame(raf)
    }
  }, [])

  return view
}
