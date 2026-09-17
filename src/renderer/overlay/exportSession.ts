import type { ConsoleView } from './useConsole'
import type { MemoryView } from './useMemory'
import type { NetworkView } from './useNetwork'
import type { PerformanceView } from './usePerformance'
import type { StorageView } from './useStorage'
import type { SecurityView } from './useSecurity'

interface SessionViews {
  network: NetworkView
  console: ConsoleView
  memory: MemoryView
  performance: PerformanceView
  storage: StorageView
  security: SecurityView
}

const headers = (value: Record<string, string> | undefined): { name: string; value: string }[] =>
  Object.entries(value ?? {}).map(([name, content]) => ({ name, value: String(content) }))

export async function exportHar(network: NetworkView): Promise<string> {
  const started = new Date().toISOString()
  const payload = {
    log: {
      version: '1.2',
      creator: { name: 'Overrun', version: '0.1.0' },
      entries: network.records.map((record) => ({
        startedDateTime: new Date(record.startedAt).toISOString(),
        time: Math.round(record.duration ?? 0),
        request: {
          method: record.method, url: record.url, httpVersion: record.protocol ?? 'HTTP/1.1',
          headers: headers(record.requestHeaders), queryString: [], cookies: [],
          headersSize: -1, bodySize: record.postData?.length ?? 0,
          ...(record.postData ? { postData: { mimeType: record.requestHeaders?.['Content-Type'] ?? '', text: record.postData } } : {})
        },
        response: {
          status: record.status ?? 0, statusText: record.statusText ?? '', httpVersion: record.protocol ?? 'HTTP/1.1',
          headers: headers(record.responseHeaders), cookies: [],
          content: { size: record.size ?? 0, mimeType: record.mimeType ?? '' },
          redirectURL: '', headersSize: -1, bodySize: record.size ?? 0
        },
        cache: {},
        timings: {
          blocked: -1, dns: record.timing?.dns ?? -1, connect: record.timing?.connect ?? -1,
          ssl: record.timing?.tls ?? -1, send: 0, wait: record.timing?.ttfb ?? -1,
          receive: record.timing?.download ?? -1
        },
        ...(record.failed ? { _overrunError: record.errorText ?? 'failed' } : {})
      })),
      pages: [{ startedDateTime: started, id: 'overrun-session', title: 'Overrun session', pageTimings: {} }]
    }
  }
  const result = await window.overrun.exportSession({ filename: `overrun-${dateStamp()}.har`, format: 'har', payload })
  return result.error ? `No se pudo exportar HAR: ${result.error}` : result.canceled ? '' : 'HAR exportado.'
}

export async function exportJson(views: SessionViews): Promise<string> {
  const payload = {
    schema: 'overrun-session/v1',
    exportedAt: new Date().toISOString(),
    network: views.network.records,
    console: views.console.records,
    memory: views.memory,
    performance: views.performance,
    storage: views.storage.latest,
    // Auditoría sin cuerpos: el body solo sale con export explícito (fase 2.0).
    security: {
      rules: views.security.state.rules,
      audit: views.security.audit.map(({ postData, ...record }) => record)
    }
  }
  const result = await window.overrun.exportSession({ filename: `overrun-${dateStamp()}.json`, format: 'json', payload })
  return result.error ? `No se pudo exportar JSON: ${result.error}` : result.canceled ? '' : 'Sesión JSON exportada.'
}

function dateStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}
