import type { Debugger } from 'electron'
import { bus } from './bus'

// ============================================================================
// Sondeo del dominio Performance (REQ-023). `Performance.getMetrics` da
// contadores ACUMULADOS; las señales por intervalo se derivan por diferencia
// entre dos sondeos. Todas atribuibles a la página (no CPU% de proceso del SO).
// ============================================================================

type Metrics = Record<string, number>

function toMap(metrics: { name: string; value: number }[]): Metrics {
  const m: Metrics = {}
  for (const { name, value } of metrics) m[name] = value
  return m
}

export function createPerformancePoller(dbg: Debugger, intervalMs = 1000): { start: () => void; stop: () => void } {
  let timer: ReturnType<typeof setInterval> | null = null
  let prev: Metrics | null = null

  const tick = async (): Promise<void> => {
    if (!dbg.isAttached()) return
    try {
      const res = (await dbg.sendCommand('Performance.getMetrics')) as { metrics: { name: string; value: number }[] }
      const cur = toMap(res.metrics)
      if (prev) {
        const dt = (cur.Timestamp ?? 0) - (prev.Timestamp ?? 0) // segundos de wall time
        if (dt > 0) {
          const d = (k: string): number => (cur[k] ?? 0) - (prev![k] ?? 0)
          bus.emitEvent({
            domain: 'performance',
            record: {
              cpuPct: Math.min(100, Math.max(0, (d('TaskDuration') / dt) * 100)),
              jsMs: d('ScriptDuration') * 1000,
              renderMs: (d('LayoutDuration') + d('RecalcStyleDuration')) * 1000,
              layouts: d('LayoutCount'),
              fps: d('Frames') / dt
            }
          })
        }
      }
      prev = cur
    } catch {
      // debugger despegándose / navegando: se reintenta al próximo tick.
    }
  }

  return {
    start(): void {
      if (timer) return
      timer = setInterval(tick, intervalMs)
      void tick()
    },
    stop(): void {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
      prev = null
    }
  }
}
