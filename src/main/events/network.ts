import { bus } from './bus'
import type { NetworkPhase, NetworkRecord, NetworkTiming } from '../../shared/events'

// ============================================================================
// Normalizador del dominio Network: CDP `Network.*` → Overrun Events.
//
// Un request evoluciona por varias fases con el mismo requestId. Mantenemos el
// registro vivo en un mapa y emitimos un NetworkEvent en cada cambio de fase.
// Fuente: dominio CDP `Network` (ver INVESTIGACION-BASE §2, REQ-020).
// ============================================================================

const records = new Map<string, NetworkRecord>()

/** ResourceTiming de CDP → NetworkTiming legible (todo en ms). */
function mapTiming(t: any): NetworkTiming | undefined {
  if (!t) return undefined
  const seg = (a: number, b: number): number | undefined =>
    a >= 0 && b >= 0 ? Math.max(0, b - a) : undefined
  return {
    dns: seg(t.dnsStart, t.dnsEnd),
    connect: seg(t.connectStart, t.connectEnd),
    tls: seg(t.sslStart, t.sslEnd),
    ttfb: seg(t.sendEnd, t.receiveHeadersEnd),
    download: undefined // se completa en loadingFinished
  }
}

function emit(phase: NetworkPhase, record: NetworkRecord): void {
  bus.emitEvent({ domain: 'network', phase, record: { ...record } })
}

/** Punto de entrada: cada mensaje del debugger CDP del dominio Network entra acá. */
export function handleCdpNetwork(method: string, params: any): void {
  switch (method) {
    case 'Network.requestWillBeSent': {
      const init = params.initiator ?? {}
      const frame = init.stack?.callFrames?.[0]
      const rec: NetworkRecord = {
        requestId: params.requestId,
        method: params.request.method,
        url: params.request.url,
        type: params.type,
        initiator: init.type,
        initiatorUrl: init.url ?? frame?.url,
        initiatorLine: init.lineNumber ?? frame?.lineNumber,
        requestHeaders: params.request.headers,
        postData: params.request.postData,
        startedAt: Date.now(),
        // timestamp CDP (segundos, monotónico) — lo guardamos para duration
        ...( { _t0: params.timestamp } as object )
      }
      records.set(params.requestId, rec)
      emit('request', rec)
      break
    }

    case 'Network.responseReceived': {
      const rec = records.get(params.requestId)
      if (!rec) break
      const r = params.response
      rec.status = r.status
      rec.statusText = r.statusText
      rec.mimeType = r.mimeType
      rec.protocol = r.protocol
      rec.type = params.type ?? rec.type
      rec.fromCache = r.fromDiskCache || r.fromPrefetchCache || false
      rec.responseHeaders = r.headers
      rec.remoteAddress = r.remoteIPAddress ? `${r.remoteIPAddress}:${r.remotePort}` : undefined
      rec.timing = mapTiming(r.timing)
      emit('response', rec)
      break
    }

    case 'Network.loadingFinished': {
      const rec = records.get(params.requestId)
      if (!rec) break
      rec.size = params.encodedDataLength
      const t0 = (rec as any)._t0 as number | undefined
      if (t0 != null) rec.duration = Math.max(0, (params.timestamp - t0) * 1000)
      emit('finished', rec)
      records.delete(params.requestId)
      break
    }

    case 'Network.loadingFailed': {
      const rec = records.get(params.requestId)
      if (!rec) break
      rec.failed = true
      rec.errorText = params.errorText || (params.canceled ? 'canceled' : 'failed')
      const t0 = (rec as any)._t0 as number | undefined
      if (t0 != null) rec.duration = Math.max(0, (params.timestamp - t0) * 1000)
      emit('failed', rec)
      records.delete(params.requestId)
      break
    }
  }
}

/** Limpia el estado al navegar a otra página. */
export function resetNetwork(): void {
  records.clear()
}
