import { useEffect, useRef, useState } from 'react'
import type { NetworkRecord, OverrunEvent } from '../../shared/events'

export interface NetworkStats {
  requests: number
  transfer: number // bytes
}

export interface NetworkView {
  records: NetworkRecord[] // orden de llegada (más nuevo al final)
  stats: NetworkStats
  throughput: { t: number[]; bytes: number[] } // por segundo, ventana móvil
  clear: () => void
}

const WINDOW_SECONDS = 60

/**
 * Recolecta Overrun Events del dominio network y los agrega para la UI.
 * Upsert por requestId (el registro evoluciona por fase). Flush por rAF para no
 * re-renderizar en cada evento (una página activa emite miles/seg).
 */
export function useNetwork(): NetworkView {
  const map = useRef(new Map<string, NetworkRecord>())
  const order = useRef<string[]>([])
  const transfer = useRef(0)
  const buckets = useRef(new Map<number, number>()) // segundo epoch → bytes
  const dirty = useRef(false)

  const clear = (): void => {
    map.current.clear()
    order.current = []
    transfer.current = 0
    buckets.current.clear()
    dirty.current = true
  }

  const [view, setView] = useState<NetworkView>({
    records: [],
    stats: { requests: 0, transfer: 0 },
    throughput: { t: [], bytes: [] },
    clear
  })

  useEffect(() => {
    const off = window.overrun.onEvent((evt: OverrunEvent) => {
      if (evt.domain !== 'network') return
      const rec = evt.record
      if (!map.current.has(rec.requestId)) order.current.push(rec.requestId)
      map.current.set(rec.requestId, rec)

      if ((evt.phase === 'finished' || evt.phase === 'failed') && rec.size) {
        transfer.current += rec.size
        const sec = Math.floor(evt.ts / 1000)
        buckets.current.set(sec, (buckets.current.get(sec) ?? 0) + rec.size)
      }
      dirty.current = true
    })

    let raf = 0
    const flush = (): void => {
      raf = requestAnimationFrame(flush)
      if (!dirty.current) return
      dirty.current = false

      const now = Math.floor(Date.now() / 1000)
      const t: number[] = []
      const bytes: number[] = []
      for (let s = now - WINDOW_SECONDS + 1; s <= now; s++) {
        t.push(s)
        bytes.push(buckets.current.get(s) ?? 0)
      }
      for (const s of buckets.current.keys()) if (s < now - WINDOW_SECONDS) buckets.current.delete(s)

      setView({
        records: order.current.map((id) => map.current.get(id)!),
        stats: { requests: order.current.length, transfer: transfer.current },
        throughput: { t, bytes },
        clear
      })
    }
    raf = requestAnimationFrame(flush)

    return () => {
      off()
      cancelAnimationFrame(raf)
    }
  }, [])

  return view
}
