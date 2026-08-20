import { useEffect, useRef, useState } from 'react'
import type { ConsoleRecord, OverrunEvent } from '../../shared/events'

export interface ConsoleView {
  records: ConsoleRecord[]
  counts: { warn: number; error: number }
  clear: () => void
}

const MAX = 2000 // tope de líneas retenidas

/** Recolecta Overrun Events del dominio console. Flush por rAF; tope circular. */
export function useConsole(): ConsoleView {
  const list = useRef<ConsoleRecord[]>([])
  const warn = useRef(0)
  const error = useRef(0)
  const dirty = useRef(false)

  const clear = (): void => {
    list.current = []
    warn.current = 0
    error.current = 0
    dirty.current = true
  }

  const [view, setView] = useState<ConsoleView>({ records: [], counts: { warn: 0, error: 0 }, clear })

  useEffect(() => {
    const off = window.overrun.onEvent((evt: OverrunEvent) => {
      if (evt.domain !== 'console') return
      list.current.push(evt.record)
      if (list.current.length > MAX) list.current.splice(0, list.current.length - MAX)
      if (evt.record.level === 'warn') warn.current++
      else if (evt.record.level === 'error') error.current++
      dirty.current = true
    })

    let raf = 0
    const flush = (): void => {
      raf = requestAnimationFrame(flush)
      if (!dirty.current) return
      dirty.current = false
      setView({ records: list.current.slice(), counts: { warn: warn.current, error: error.current }, clear })
    }
    raf = requestAnimationFrame(flush)

    return () => {
      off()
      cancelAnimationFrame(raf)
    }
  }, [])

  return view
}
