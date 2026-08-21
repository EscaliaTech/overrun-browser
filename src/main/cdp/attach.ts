import type { WebContents } from 'electron'
import { handleCdpNetwork, resetNetwork } from '../events/network'
import { handleCdpConsole } from '../events/console'
import { createMemoryPoller } from '../events/memory'
import { createPerformancePoller } from '../events/performance'
import { createStoragePoller } from '../events/storage'

// ============================================================================
// Capa CDP (D-002) — DESACOPLADA de la base (REQ-062): si mañana se migra a
// CEF/fork, se reusa toda la lógica de normalización; solo cambia este adaptador.
//
// Adjunta el Chrome DevTools Protocol al webContents de la PÁGINA (no de la UI),
// desde fuera de su DOM/contexto JS (REQ-012). En el MVP solo habilita Network.
// ============================================================================

const PROTOCOL_VERSION = '1.3'

// Adjunta CDP a una página y devuelve un `dispose` que revierte todo (detach del
// debugger, pollers y listeners). Solo la pestaña ACTIVA está adjunta a la vez: el
// normalizador de red es un stream único, así que dos tabs adjuntas se pisarían.
export function attachCdp(page: WebContents): () => void {
  const dbg = page.debugger
  try {
    if (!dbg.isAttached()) dbg.attach(PROTOCOL_VERSION)
  } catch (err) {
    console.error('[cdp] no se pudo adjuntar el debugger:', err)
    return () => {}
  }

  // Rutea cada mensaje CDP al normalizador de su dominio.
  const onMessage = (_event: unknown, method: string, params: unknown): void => {
    if (method.startsWith('Network.')) handleCdpNetwork(method, params)
    else if (method === 'Runtime.consoleAPICalled' || method === 'Runtime.exceptionThrown' || method === 'Log.entryAdded') {
      handleCdpConsole(method, params)
    }
    // Próximas fases: HeapProfiler/Memory → memory, Performance → performance, etc.
  }
  dbg.on('message', onMessage)

  const memory = createMemoryPoller(dbg)
  const performance = createPerformancePoller(dbg)
  const storage = createStoragePoller(dbg, page)

  const onDetach = (_event: unknown, reason: string): void => {
    console.warn('[cdp] debugger detached:', reason)
    memory.stop()
    performance.stop()
    storage.stop()
  }
  dbg.on('detach', onDetach)

  // Dominios habilitados: Network (D-015) + Runtime/Log (REQ-021) + Performance (REQ-023).
  dbg.sendCommand('Network.enable').catch((e) => console.error('[cdp] Network.enable', e))
  dbg.sendCommand('Runtime.enable').catch((e) => console.error('[cdp] Runtime.enable', e))
  dbg.sendCommand('Log.enable').catch((e) => console.error('[cdp] Log.enable', e))
  dbg.sendCommand('Performance.enable').catch((e) => console.error('[cdp] Performance.enable', e))

  // Sondeos periódicos (REQ-022 / REQ-023 / REQ-024).
  memory.start()
  performance.start()
  storage.start()

  // Al navegar a otra página, limpiamos el estado de red acumulado.
  const onNavigation = (_e: unknown, _url: string, isInPlace: boolean, isMainFrame: boolean): void => {
    if (isMainFrame && !isInPlace) resetNetwork()
  }
  page.on('did-start-navigation', onNavigation)

  return () => {
    memory.stop()
    performance.stop()
    storage.stop()
    dbg.off('message', onMessage)
    dbg.off('detach', onDetach)
    if (!page.isDestroyed()) page.off('did-start-navigation', onNavigation)
    try {
      if (dbg.isAttached()) dbg.detach()
    } catch {
      // El webContents pudo destruirse antes; detach ya no aplica.
    }
    resetNetwork()
  }
}
