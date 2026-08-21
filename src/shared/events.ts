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
// Dominio: performance (v1 — REQ-023)
//
// Señales ATRIBUIBLES A LA PÁGINA (no CPU% de proceso del SO). Se derivan de
// `Performance.getMetrics` (contadores acumulados) por diferencia entre sondeos.
// ---------------------------------------------------------------------------

export interface PerformanceRecord {
  /** utilización del hilo principal en el intervalo: task time / wall time (%). */
  cpuPct: number
  /** ms de ejecución de JS en el intervalo (ScriptDuration). */
  jsMs: number
  /** ms de layout + recalc de estilos en el intervalo. */
  renderMs: number
  /** layouts en el intervalo. */
  layouts: number
  /** frames por segundo (delta de Frames / intervalo). */
  fps: number
}

export interface PerformanceEvent extends OverrunEventBase {
  domain: 'performance'
  record: PerformanceRecord
}

// ---------------------------------------------------------------------------
// Dominio: storage (v1 — REQ-024)
//
// Uso por tipo de almacenamiento del origen de la página. Se obtiene por COMANDO
// (`Storage.getUsageAndQuota`) — el main lo sondea y emite snapshots.
// ---------------------------------------------------------------------------

export interface StorageBreakdown {
  /** cookies, indexeddb, localstorage, cache_storage, service_workers… */
  type: string
  bytes: number
}

export interface StorageRecord {
  origin: string
  usage: number // bytes usados en total
  quota: number // bytes disponibles
  breakdown: StorageBreakdown[]
}

export interface StorageEvent extends OverrunEventBase {
  domain: 'storage'
  record: StorageRecord
}

// Detalle on-demand del storage del origen activo (entradas reales, no solo tamaño).
export interface CookieInfo {
  name: string
  value: string
  domain: string
  path: string
  size: number
  httpOnly: boolean
  secure: boolean
  expires: number // -1 = sesión
}

export interface StorageKV {
  key: string
  value: string
}

export interface StorageDetail {
  origin: string
  cookies: CookieInfo[]
  local: StorageKV[]
  session: StorageKV[]
}

// ---------------------------------------------------------------------------
// Unión de todos los eventos del bus. Otros dominios se suman aquí sin rediseño.
// ---------------------------------------------------------------------------

export type OverrunEvent = NetworkEvent | ConsoleEvent | MemoryEvent | PerformanceEvent | StorageEvent
// | SecurityEvent (v2)

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
  /** overlay → main: redimensionar el panel desde la esquina superior-izquierda. */
  overlayResize: 'overrun:overlay-resize',
  /** overlay → main (invoke): pide el body de una respuesta on-demand. */
  getResponseBody: 'overrun:get-response-body',
  /** overlay → main (invoke): detalle de storage del origen activo (cookies, items). */
  getStorageDetail: 'overrun:get-storage-detail',
  /** chrome → main: expandir/contraer la vista del chrome para que un popup
   *  (dropdown de historial) pueda dibujarse sobre la página sin recortarse. */
  chromeExpand: 'overrun:chrome-expand',

  // ---- pestañas (multi-tab) ----
  /** main → chrome: lista de pestañas + cuál está activa. */
  tabsState: 'overrun:tabs-state',
  /** chrome → main: abrir una pestaña nueva. */
  tabNew: 'overrun:tab-new',
  /** chrome → main: cerrar una pestaña por id. */
  tabClose: 'overrun:tab-close',
  /** chrome → main: activar una pestaña por id. */
  tabActivate: 'overrun:tab-activate',

  // ---- bookmarks ----
  /** main → chrome: estado de bookmarks (lista, barra visible, url actual guardada). */
  bookmarksState: 'overrun:bookmarks-state',
  /** chrome → main: guardar/quitar la URL de la pestaña activa. */
  bookmarkToggle: 'overrun:bookmark-toggle',
  /** chrome → main: abrir un bookmark (navega la pestaña activa). */
  bookmarkOpen: 'overrun:bookmark-open',
  /** chrome → main: quitar un bookmark por id. */
  bookmarkRemove: 'overrun:bookmark-remove',
  /** chrome → main: mostrar/ocultar la barra de bookmarks (retráctil). */
  bookmarksBarToggle: 'overrun:bookmarks-bar-toggle',

  // ---- historial ----
  /** main → chrome: visitas recientes (persistidas) para sugerencias de la barra. */
  historyState: 'overrun:history-state',
  /** chrome → main: limpiar el historial persistido. */
  historyClear: 'overrun:history-clear'
} as const

export interface ResponseBody {
  body: string
  base64: boolean
}

/** Una pestaña abierta, como la ve el chrome (el WebContentsView vive en el main). */
export interface TabInfo {
  id: string
  title: string
  url: string
  loading: boolean
}

export interface TabsState {
  tabs: TabInfo[]
  activeId: string
}

export interface Bookmark {
  id: string
  url: string
  title: string
}

export interface BookmarksState {
  items: Bookmark[]
  /** barra de bookmarks desplegada (retráctil). */
  barVisible: boolean
  /** la URL de la pestaña activa ya está guardada (estrella llena). */
  currentSaved: boolean
}

export interface HistoryEntry {
  url: string
  title: string
  ts: number
}

export interface HistoryState {
  items: HistoryEntry[]
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
  /** resolución real del viewport de la página (pestaña activa). */
  viewport: Viewport
}

export type NavAction = 'back' | 'forward' | 'reload' | 'stop'
export type OverlayControl = 'toggle' | 'collapse' | 'expand' | 'toggle-clickthrough'
