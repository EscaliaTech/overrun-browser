import type { WebContents } from 'electron'
import { handleCdpNetwork, resetNetwork } from '../events/network'
import { handleCdpConsole } from '../events/console'
import { createMemoryPoller } from '../events/memory'

// ============================================================================
// Capa CDP (D-002) — DESACOPLADA de la base (REQ-062): si mañana se migra a
// CEF/fork, se reusa toda la lógica de normalización; solo cambia este adaptador.
//
// Adjunta el Chrome DevTools Protocol al webContents de la PÁGINA (no de la UI),
// desde fuera de su DOM/contexto JS (REQ-012). En el MVP solo habilita Network.
// ============================================================================

const PROTOCOL_VERSION = '1.3'

export function attachCdp(page: WebContents): void {
  const dbg = page.debugger
  try {
    if (!dbg.isAttached()) dbg.attach(PROTOCOL_VERSION)
  } catch (err) {
    console.error('[cdp] no se pudo adjuntar el debugger:', err)
    return
  }

  // Rutea cada mensaje CDP al normalizador de su dominio.
  dbg.on('message', (_event, method, params) => {
    if (method.startsWith('Network.')) handleCdpNetwork(method, params)
    else if (method === 'Runtime.consoleAPICalled' || method === 'Runtime.exceptionThrown' || method === 'Log.entryAdded') {
      handleCdpConsole(method, params)
    }
    // Próximas fases: HeapProfiler/Memory → memory, Performance → performance, etc.
  })

  const memory = createMemoryPoller(dbg)

  dbg.on('detach', (_event, reason) => {
    console.warn('[cdp] debugger detached:', reason)
    memory.stop()
  })

  // Dominios habilitados: Network (D-015) + Runtime/Log para consola (REQ-021).
  dbg.sendCommand('Network.enable').catch((e) => console.error('[cdp] Network.enable', e))
  dbg.sendCommand('Runtime.enable').catch((e) => console.error('[cdp] Runtime.enable', e))
  dbg.sendCommand('Log.enable').catch((e) => console.error('[cdp] Log.enable', e))

  // Sondeo periódico de memoria (REQ-022).
  memory.start()

  // Al navegar a otra página, limpiamos el estado de red acumulado.
  page.on('did-start-navigation', (_e, _url, isInPlace, isMainFrame) => {
    if (isMainFrame && !isInPlace) resetNetwork()
  })
}
