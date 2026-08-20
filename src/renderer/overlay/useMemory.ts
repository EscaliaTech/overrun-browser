import { useEffect, useRef, useState } from 'react'
import type { MemoryRecord, OverrunEvent } from '../../shared/events'

export interface MemoryView {
  latest: MemoryRecord | null
  series: { t: number[]; used: number[] }
}

const WINDOW = 120 // ~2 min a 1 snapshot/s

/** Colecta snapshots de memoria (REQ-022). Llegan ~1/s → setState directo. */
export function useMemory(): MemoryView {
  const t = useRef<number[]>([])
  const used = useRef<number[]>([])
  const [view, setView] = useState<MemoryView>({ latest: null, series: { t: [], used: [] } })

  useEffect(() => {
    return window.overrun.onEvent((evt: OverrunEvent) => {
      if (evt.domain !== 'memory') return
      t.current.push(evt.ts / 1000)
      used.current.push(evt.record.jsHeapUsed)
      if (t.current.length > WINDOW) {
        t.current.shift()
        used.current.shift()
      }
      setView({ latest: evt.record, series: { t: t.current.slice(), used: used.current.slice() } })
    })
  }, [])

  return view
}
