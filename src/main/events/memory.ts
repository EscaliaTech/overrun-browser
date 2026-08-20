import type { Debugger } from 'electron'
import { bus } from './bus'

// ============================================================================
// Sondeo del dominio Memory (REQ-022). Heap y DOM counters son COMANDOS, no
// eventos push → el main los pide cada `intervalMs` y emite un snapshot al bus.
// ============================================================================

export function createMemoryPoller(dbg: Debugger, intervalMs = 1000): { start: () => void; stop: () => void } {
  let timer: ReturnType<typeof setInterval> | null = null

  const tick = async (): Promise<void> => {
    if (!dbg.isAttached()) return
    try {
      const heap = (await dbg.sendCommand('Runtime.getHeapUsage')) as { usedSize: number; totalSize: number }
      const dom = (await dbg.sendCommand('Memory.getDOMCounters')) as {
        documents: number
        nodes: number
        jsEventListeners: number
      }
      bus.emitEvent({
        domain: 'memory',
        record: {
          jsHeapUsed: heap.usedSize,
          jsHeapTotal: heap.totalSize,
          domNodes: dom.nodes,
          documents: dom.documents,
          listeners: dom.jsEventListeners
        }
      })
    } catch {
      // El debugger puede estar despegándose o navegando; se reintenta al próximo tick.
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
    }
  }
}
