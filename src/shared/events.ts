// ============================================================================
// Overrun Events — modelo de datos de observabilidad (D-013 / REQ-066)
//
// Capa de normalización entre CDP y los consumidores. CDP no se conecta directo
// a la UI: sus eventos crudos se convierten en eventos TIPADOS POR DOMINIO con
// esquema estable. El mismo stream alimenta la UI (overlay) y, en v3, el MCP.
//
// Compartido entre main y renderer para tener una única fuente de verdad del tipo.
// ============================================================================

export type Domain =
  | 'network'
  | 'console'
  | 'memory'
  | 'performance'
  | 'storage'
  | 'security' // v2

/** Envelope común a todo evento del bus. */
export interface OverrunEventBase {
  /** id incremental, orden de emisión. */
  seq: number
  domain: Domain
  /** epoch ms en el que Overrun normalizó el evento. */
  ts: number
}

// ---------------------------------------------------------------------------
// Dominio: network (MVP — REQ-020)
// ---------------------------------------------------------------------------

export type NetworkPhase = 'request' | 'response' | 'finished' | 'failed'

/** Timing del request (ms relativos), subconjunto legible del ResourceTiming de CDP. */
export interface NetworkTiming {
  dns?: number
  connect?: number
  tls?: number
  ttfb?: number
  download?: number
}

/**
 * Registro de un request que EVOLUCIONA: se emite en cada fase (request →
 * response → finished/failed) con el mismo `requestId`. La UI hace upsert por
 * requestId, no acumula duplicados. Ver desglose de campos en REQ-020.
 */
export interface NetworkRecord {
  requestId: string
  method: string
  url: string
  type?: string // document, script, xhr, fetch, image, ws, …
  status?: number
  statusText?: string
  mimeType?: string
  /** bytes transferidos (encodedDataLength). */
  size?: number
  /** duración total ms (finished/failed). */
  duration?: number
  timing?: NetworkTiming
  /** qué originó el request: parser, script, redirect… */
  /** qué originó el request: parser, script, redirect… */
  initiator?: string
  initiatorUrl?: string
  initiatorLine?: number
  /** protocolo negociado: h1/h2/h3. */
  protocol?: string
  /** IP:puerto del servidor (connection). */
  remoteAddress?: string
  requestHeaders?: Record<string, string>
  responseHeaders?: Record<string, string>
  /** body enviado (si lo hay y es chico). */
  postData?: string
  fromCache?: boolean
  failed?: boolean
  errorText?: string
  /** marca de tiempo de inicio (epoch ms), para calcular waterfalls. */
  startedAt: number
}

export interface NetworkEvent extends OverrunEventBase {
  domain: 'network'
  phase: NetworkPhase
  record: NetworkRecord
}

// ---------------------------------------------------------------------------
// Dominio: console (v1 — REQ-021)
// ---------------------------------------------------------------------------

export type ConsoleLevel = 'log' | 'info' | 'warn' | 'error' | 'debug'

/** De dónde salió la entrada: API de consola, excepción no capturada, o log del navegador. */
export type ConsoleOrigin = 'console' | 'exception' | 'browser'

export interface ConsoleRecord {
  id: number
  level: ConsoleLevel
  origin: ConsoleOrigin
  text: string
  url?: string
  line?: number
}

export interface ConsoleEvent extends OverrunEventBase {
  domain: 'console'
  record: ConsoleRecord
}

// ---------------------------------------------------------------------------
// Dominio: memory (v1 — REQ-022)
//
// A diferencia de network/console (eventos que CDP empuja), heap y DOM counters
// se obtienen por COMANDO — el main los sondea periódicamente y emite snapshots.
// ---------------------------------------------------------------------------

export interface MemoryRecord {
  jsHeapUsed: number // bytes
  jsHeapTotal: number // bytes
  domNodes: number
  documents: number
  listeners: number
}

export interface MemoryEvent extends OverrunEventBase {
  domain: 'memory'
  record: MemoryRecord
}

// ---------------------------------------------------------------------------
// Unión de todos los eventos del bus. Otros dominios se suman aquí sin rediseño.
// ---------------------------------------------------------------------------

export type OverrunEvent = NetworkEvent | ConsoleEvent | MemoryEvent
// | PerformanceEvent | StorageEvent | SecurityEvent (próximas fases)

/** Canales IPC — un único punto para no tipear strings sueltos. */
export const IPC = {
  /** main → overlay: un OverrunEvent normalizado. */
  event: 'overrun:event',
  /** main → chrome: estado de navegación (url, canGoBack…). */
  navState: 'overrun:nav-state',
  /** chrome → main: navegar a una URL. */
  navigate: 'overrun:navigate',
  /** chrome → main: back/forward/reload. */
  navAction: 'overrun:nav-action',
  /** chrome/overlay → main: mostrar/ocultar overlay o alternar click-through (D-017). */
  overlayControl: 'overrun:overlay-control',
  /** main → overlay: estado colapsado (fuente de verdad en el main). */
  overlayState: 'overrun:overlay-state',
  /** overlay → main: arrastrar el panel (delta en px de pantalla). */
  overlayMove: 'overrun:overlay-move',
  /** overlay → main (invoke): pide el body de una respuesta on-demand. */
  getResponseBody: 'overrun:get-response-body'
} as const

export interface ResponseBody {
  body: string
  base64: boolean
}

export interface Viewport {
  width: number
  height: number
}

export interface NavState {
  url: string
  canGoBack: boolean
  canGoForward: boolean
  loading: boolean
  /** resolución real del viewport de la página (pageView). */
  viewport: Viewport
}

export type NavAction = 'back' | 'forward' | 'reload' | 'stop'
export type OverlayControl = 'toggle' | 'collapse' | 'expand' | 'toggle-clickthrough'
