import { useEffect, useRef, useState } from 'react'
import type { OverrunEvent, PerformanceRecord } from '../../shared/events'

export interface PerformanceView {
  latest: PerformanceRecord | null
  series: { t: number[]; cpu: number[] }
}

const WINDOW = 120

/** Colecta snapshots de performance (REQ-023). Llegan ~1/s. */
export function usePerformance(): PerformanceView {
  const t = useRef<number[]>([])
  const cpu = useRef<number[]>([])
  const [view, setView] = useState<PerformanceView>({ latest: null, series: { t: [], cpu: [] } })

  useEffect(() => {
    return window.overrun.onEvent((evt: OverrunEvent) => {
      if (evt.domain !== 'performance') return
      t.current.push(evt.ts / 1000)
      cpu.current.push(evt.record.cpuPct)
      if (t.current.length > WINDOW) {
        t.current.shift()
        cpu.current.shift()
      }
      setView({ latest: evt.record, series: { t: t.current.slice(), cpu: cpu.current.slice() } })
    })
  }, [])

  return view
}
