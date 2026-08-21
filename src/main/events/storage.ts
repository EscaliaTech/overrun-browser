import type { Debugger, WebContents } from 'electron'
import { bus } from './bus'
import type { StorageBreakdown } from '../../shared/events'

// ============================================================================
// Sondeo del dominio Storage (REQ-024). `Storage.getUsageAndQuota` da el uso por
// tipo de almacenamiento del origen actual (cookies, localStorage, IndexedDB,
// cache, service workers…). Es un COMANDO → el main lo sondea y emite snapshots.
// ============================================================================

function originOf(url: string): string | null {
  try {
    const o = new URL(url).origin
    return /^https?:/.test(o) ? o : null
  } catch {
    return null
  }
}

export function createStoragePoller(dbg: Debugger, page: WebContents, intervalMs = 2000): { start: () => void; stop: () => void } {
  let timer: ReturnType<typeof setInterval> | null = null

  const tick = async (): Promise<void> => {
    if (!dbg.isAttached()) return
    const origin = originOf(page.getURL())
    if (!origin) return // about:blank u orígenes sin storage
    try {
      const res = (await dbg.sendCommand('Storage.getUsageAndQuota', { origin })) as {
        usage: number
        quota: number
        usageBreakdown: { storageType: string; usage: number }[]
      }
      const breakdown: StorageBreakdown[] = (res.usageBreakdown ?? [])
        .filter((b) => b.usage > 0)
        .map((b) => ({ type: b.storageType, bytes: b.usage }))
        .sort((a, b) => b.bytes - a.bytes)
      bus.emitEvent({
        domain: 'storage',
        record: { origin, usage: res.usage, quota: res.quota, breakdown }
      })
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
    }
  }
}
