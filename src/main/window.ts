import { join } from 'node:path'
import { writeFile } from 'node:fs/promises'
import { app, BaseWindow, dialog, WebContentsView, ipcMain, type WebContents } from 'electron'
import { is } from '@electron-toolkit/utils'
import { attachCdp, type CdpAttachment } from './cdp/attach'
import { bus } from './events/bus'
import {
  IPC,
  type NavAction,
  type NavState,
  type OverlayControl,
  type ResponseBody,
  type TabsState,
  type BookmarksState,
  type HistoryState,
  type StorageDetail,
  type StorageKV,
  type ViewportState,
  type ViewportSet,
  type ViewportApplyResult,
  type SessionExport,
  type ExportResult,
  type AppInfo,
  type SecurityAction,
  type SecurityActionResult,
  type SecurityState,
  type FindQuery
} from '../shared/events'
import { parseRules } from '../shared/security'
import {
  listBookmarks,
  isBarVisible,
  isSaved,
  toggleBookmark,
  removeBookmark,
  toggleBar
} from './bookmarks'
import { addVisit, recentVisits, clearHistory } from './history'
import { loadSession, saveSession } from './session'
import { FIT_VIEWPORT, resolveViewport, viewportGeometry, type ViewportConfig } from '../shared/viewport'

// ============================================================================
// Ventana Overrun — arquitectura de dos superficies apiladas (D-003 / REQ-010,014):
//
//   BaseWindow
//   ├── pageView[activa] (WebContentsView) → página full-size o viewport emulado
//   ├── chromeView       (WebContentsView) → barra + tabs (React), franja superior
//   └── overlayView      (WebContentsView) → panel flotante; chrome modal encima
//
// Multi-tab: cada pestaña es su propio WebContentsView (historial/DOM propios). Solo
// la ACTIVA está montada en el árbol de vistas y adjunta a CDP (el normalizador de
// red es un stream único). Las de fondo siguen vivas y cargando, solo que ocultas.
//
// El overlay NO forma parte del viewport de la página: flota encima, no la
// redimensiona (REQ-014). La página ocupa todo el alto bajo la barra de chrome.
// ============================================================================

const TAB_STRIP_H = 40
const TOOLBAR_H = 52
const BOOKMARKS_BAR_H = 40
const CHROME_BASE = TAB_STRIP_H + TOOLBAR_H // 92
const MARGIN = 26
const OVERLAY_COLLAPSED = { w: 232, h: 44 }
const OVERLAY_MIN = { w: 340, h: 320 }
const OVERLAY_MAX = { w: 900, h: 1200 }
const START_URL = 'https://example.com'
const overrunUserAgent = (ua: string): string => ua.includes('Overrun/') ? ua : `${ua} Overrun/${app.getVersion()}`

// Alto del chrome: crece cuando la barra de bookmarks está desplegada (retráctil).
function chromeHeight(): number {
  return CHROME_BASE + (isBarVisible() ? BOOKMARKS_BAR_H : 0)
}

// Tamaño expandido — mutable (redimensionable por el usuario, REQ v1).
let overlaySize = { w: 452, h: 560 }

interface Tab {
  id: string
  view: WebContentsView
  // Teardown de CDP mientras la pestaña es la activa; null cuando está de fondo.
  cdp: CdpAttachment | null
}

let win: BaseWindow
let chromeView: WebContentsView
let overlayView: WebContentsView
let tabs: Tab[] = []
let activeId = ''
let tabSeq = 0
let overlayCollapsed = false
// Chrome expandido: cubre toda la ventana (transparente) para que un popup del
// chrome (dropdown de historial) se dibuje sobre la página sin recortarse.
let chromeExpanded = false
// Posición del overlay: null = anclado a la esquina (default, responsive);
// una vez arrastrado, queda fijo en {x,y} (top-left).
let overlayPos: { x: number; y: number } | null = null

// Logical dimensions are independent of the native view's display bounds.
let viewport: ViewportConfig = { ...FIT_VIEWPORT }
let viewportError: string | undefined
const emulationQueue = new WeakMap<WebContents, Promise<void>>()
const emulationRevision = new WeakMap<WebContents, number>()

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), Math.max(lo, hi))

function activeTab(): Tab | undefined {
  return tabs.find((t) => t.id === activeId)
}

function securityState(): SecurityState {
  return activeTab()?.cdp?.security?.state() ?? {
    enabled: false, pending: 0, timeoutMs: 15_000, maxPending: 50, rules: [], message: 'CDP no disponible en esta pestaña.'
  }
}

function sendSecurityState(): void {
  overlayView.webContents.send(IPC.securityState, securityState())
}

function hostOf(url: string): string {
  try {
    return new URL(url).host || url
  } catch {
    return url
  }
}

function loadEntry(view: WebContentsView, entry: 'chrome' | 'overlay'): void {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    view.webContents.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/${entry}/index.html`)
  } else {
    view.webContents.loadFile(join(__dirname, `../renderer/${entry}/index.html`))
  }
}

/** Posición por defecto: esquina inferior-derecha. */
function cornerPos(width: number, height: number, o: { w: number; h: number }): { x: number; y: number } {
  return { x: width - o.w - MARGIN, y: height - o.h - MARGIN }
}

function layout(): void {
  const { width, height } = win.getContentBounds()
  const ch = chromeHeight()
  chromeView.setBounds({ x: 0, y: 0, width, height: chromeExpanded ? height : ch })
  const at = activeTab()
  if (at) {
    const box = viewportGeometry(viewport, width, height - ch)
    at.view.setBounds({ x: box.x, y: ch + box.y, width: box.width, height: box.height })
  }

  const o = overlayCollapsed ? OVERLAY_COLLAPSED : overlaySize
  const pos = overlayPos ?? cornerPos(width, height, o)
  overlayView.setBounds({
    x: clamp(pos.x, 0, width - o.w),
    y: clamp(pos.y, ch, height - o.h),
    width: o.w,
    height: o.h
  })
}

function sendOverlayState(): void {
  overlayView.webContents.send(IPC.overlayState, overlayCollapsed)
}

function sendNavState(): void {
  const at = activeTab()
  if (!at) return
  const wc = at.view.webContents
  const b = at.view.getBounds()
  const state: NavState = {
    url: wc.getURL(),
    canGoBack: wc.navigationHistory.canGoBack(),
    canGoForward: wc.navigationHistory.canGoForward(),
    loading: wc.isLoading(),
    viewport: viewport.presetId === null
      ? { width: b.width, height: b.height }
      : { width: viewport.width, height: viewport.height }
  }
  chromeView.webContents.send(IPC.navState, state)
}

function sendTabs(): void {
  const state: TabsState = {
    tabs: tabs.map((t) => {
      const wc = t.view.webContents
      const url = wc.getURL()
      return {
        id: t.id,
        title: wc.getTitle() || hostOf(url) || 'nueva pestaña',
        url,
        loading: wc.isLoading()
      }
    }),
    activeId
  }
  chromeView.webContents.send(IPC.tabsState, state)
}

function sendBookmarks(): void {
  const url = activeTab()?.view.webContents.getURL() ?? ''
  const state: BookmarksState = {
    items: listBookmarks(),
    barVisible: isBarVisible(),
    currentSaved: isSaved(url)
  }
  chromeView.webContents.send(IPC.bookmarksState, state)
}

// Historial completo persistido → chrome (para autocompletar contra TODO lo
// visitado, no solo lo reciente: escribir "you" sugiere youtube aunque sea viejo).
function sendHistory(): void {
  const state: HistoryState = { items: recentVisits(300) }
  chromeView.webContents.send(IPC.historyState, state)
}

// Serialize commands per page: rapid resize/rotate/tab changes cannot leave a
// mixture of old metrics and new touch/UA settings. Superseded work is skipped.
function applyEmulation(wc: WebContents): Promise<void> {
  const revision = (emulationRevision.get(wc) ?? 0) + 1
  emulationRevision.set(wc, revision)
  const config = { ...viewport }
  const { width, height } = win.getContentBounds()
  const box = viewportGeometry(config, width, height - chromeHeight())
  const current = (): boolean => !wc.isDestroyed() && activeTab()?.view.webContents === wc &&
    emulationRevision.get(wc) === revision
  const task = (emulationQueue.get(wc) ?? Promise.resolve()).then(async () => {
    if (!current()) return
    try {
      const dbg = wc.debugger
      if (!dbg.isAttached()) throw new Error('CDP no disponible')
      if (config.presetId === null) {
        // Electron preserves a prior layout viewport after clearDeviceMetrics.
        // Keep fit mode synchronized to the native view with an explicit zero-DPR
        // override, which restores host DPR while producing a reliable resize.
        await dbg.sendCommand('Emulation.setDeviceMetricsOverride', {
          width: box.width,
          height: box.height,
          screenWidth: box.width,
          screenHeight: box.height,
          deviceScaleFactor: 0,
          mobile: false
        })
      } else {
        await dbg.sendCommand('Emulation.setDeviceMetricsOverride', {
          width: config.width,
          height: config.height,
          screenWidth: config.width,
          screenHeight: config.height,
          deviceScaleFactor: config.dpr,
          mobile: config.mobile,
          scale: box.scale,
          screenOrientation: {
            type: config.width > config.height ? 'landscapePrimary' : 'portraitPrimary',
            angle: config.width > config.height ? 90 : 0
          }
        })
      }
      if (!current()) return
      await dbg.sendCommand('Emulation.setTouchEmulationEnabled', { enabled: config.touch })
      if (!current()) return
      await dbg.sendCommand('Emulation.setUserAgentOverride', {
        userAgent: overrunUserAgent(config.ua || (config.presetId === null ? app.userAgentFallback : wc.getUserAgent()))
      })
      if (current()) viewportError = undefined
    } catch (err) {
      if (!current()) return
      viewportError = 'No se pudo aplicar la emulacion. Volve a elegir el tamano.'
      console.error('[emulation]', err)
    }
    if (current()) sendViewport()
  })
  emulationQueue.set(wc, task)
  return task
}

function sendViewport(): void {
  const { width, height } = win.getContentBounds()
  const state: ViewportState = {
    ...viewport,
    scale: viewportGeometry(viewport, width, height - chromeHeight()).scale,
    error: viewportError
  }
  chromeView.webContents.send(IPC.viewportState, state)
}

function viewportState(): ViewportState {
  const { width, height } = win.getContentBounds()
  return {
    ...viewport,
    scale: viewportGeometry(viewport, width, height - chromeHeight()).scale,
    error: viewportError
  }
}

function refreshViewportLayout(): void {
  layout()
  const wc = activeTab()?.view.webContents
  if (wc) void applyEmulation(wc)
  sendViewport()
  sendNavState()
}

// Persiste las pestañas abiertas (URLs + activa). No guarda durante el arranque
// (antes de restaurar) para no pisar la sesión con una lista vacía.
let restoring = true
function storeSession(): void {
  if (restoring) return
  saveSession({
    tabs: tabs.map((t) => t.view.webContents.getURL()),
    activeIndex: Math.max(0, tabs.findIndex((t) => t.id === activeId)),
    viewport: viewport.presetId === null
      ? { presetId: null }
      : viewport.presetId === 'custom'
        ? { presetId: 'custom', width: viewport.width, height: viewport.height, dpr: viewport.dpr, mobile: viewport.mobile, touch: viewport.touch }
        : { presetId: viewport.presetId, landscape: viewport.landscape }
  })
}

// Listeners de navegación de una pestaña: refrescan la tira de tabs y, si es la
// activa, el estado de navegación y de bookmarks (la estrella depende de la URL).
function wireTabEvents(tab: Tab): void {
  const wc = tab.view.webContents
  const update = (): void => {
    sendTabs()
    if (tab.id === activeId) {
      sendNavState()
      sendBookmarks()
    }
  }
  const record = (): void => {
    addVisit(wc.getURL(), wc.getTitle())
    sendHistory()
    storeSession() // la URL de la pestaña cambió
  }
  wc.on('page-title-updated', () => { update(); addVisit(wc.getURL(), wc.getTitle()); sendHistory() })
  wc.on('did-navigate', () => { update(); record() })
  wc.on('did-navigate-in-page', update)
  wc.on('did-start-loading', update)
  wc.on('did-stop-loading', update)
  // Una navegación completa resetea los overrides de Emulation: re-aplicar si esta
  // pestaña es la activa y hay un device mode puesto.
  wc.on('did-finish-load', () => {
    if (tab.id === activeId && viewport.presetId !== null) void applyEmulation(wc)
  })
  // Resultado de find-in-page (Ctrl+F): reenviar a la barra si es la pestaña activa.
  wc.on('found-in-page', (_e, result) => {
    if (tab.id === activeId) {
      chromeView.webContents.send(IPC.findResult, {
        matches: result.matches ?? 0,
        active: result.activeMatchOrdinal ?? 0
      })
    }
  })
  attachShortcuts(wc)
}

function normUrl(url: string): string {
  return /^(https?|about|file):/i.test(url) ? url : `https://${url}`
}

function createTab(url: string = START_URL, activate = true): void {
  const view = new WebContentsView({
    webPreferences: { sandbox: true, contextIsolation: true } // sin preload: web no confiable
  })
  const tab: Tab = { id: `tab-${(tabSeq++).toString(36)}`, view, cdp: null }
  tabs.push(tab)
  wireTabEvents(tab)
  view.webContents.loadURL(normUrl(url)).catch((err) => console.error('[nav]', err))
  if (activate) activateTab(tab.id)
  else sendTabs()
  storeSession()
}

function activateTab(id: string): void {
  if (id === activeId) return // clic en la pestaña ya activa: nada que remontar
  const next = tabs.find((t) => t.id === id)
  if (!next) return

  const prev = activeTab()
  if (prev && prev.id !== id) {
    if (prev.cdp) {
      prev.cdp.dispose()
      prev.cdp = null
    }
    win.contentView.removeChildView(prev.view)
  }

  activeId = id
  // Índice 0 = fondo del z-order: la página queda bajo chrome y overlay.
  win.contentView.addChildView(next.view, 0)
  if (!next.cdp) next.cdp = attachCdp(next.view.webContents)

  layout()
  void applyEmulation(next.view.webContents) // el device mode sigue a la pestaña activa
  sendTabs()
  sendNavState()
  sendBookmarks()
  sendHistory()
  sendViewport()
  sendSecurityState()
  storeSession()
}

function closeTab(id: string): void {
  const idx = tabs.findIndex((t) => t.id === id)
  if (idx < 0) return
  const tab = tabs[idx]
  const wasActive = tab.id === activeId

  if (tab.cdp) {
    tab.cdp.dispose()
    tab.cdp = null
  }
  if (wasActive) win.contentView.removeChildView(tab.view)
  tabs.splice(idx, 1)
  if (!tab.view.webContents.isDestroyed()) tab.view.webContents.close()

  // Se mantiene siempre ≥1 pestaña: cerrar la última abre una en blanco.
  if (tabs.length === 0) {
    createTab(START_URL)
    return
  }
  if (wasActive) {
    const neighbor = tabs[Math.min(idx, tabs.length - 1)]
    activeId = ''
    activateTab(neighbor.id)
  } else {
    sendTabs()
  }
  storeSession()
}

export function createWindow(): void {
  win = new BaseWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0a0b0d', // Void (BRANDING)
    title: 'Overrun',
    // Sin barra de título nativa: el chrome propio llega hasta el borde superior
    // (BRANDING). Los controles nativos min/max/cerrar se dibujan como overlay
    // sobre el tab strip (alto 40); ese strip es la zona de arrastre de la ventana.
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0a0b0d', symbolColor: '#cfd3d9', height: TAB_STRIP_H }
  })

  const uiPrefs = { preload: join(__dirname, '../preload/index.js'), sandbox: true, contextIsolation: true }

  // Orden de addChildView = z-order. La página activa se inserta luego en índice 0
  // (fondo); chrome y overlay quedan siempre por encima.
  chromeView = new WebContentsView({ webPreferences: uiPrefs })
  overlayView = new WebContentsView({ webPreferences: uiPrefs })
  overlayView.setBackgroundColor('#00000000') // transparente donde el panel no pinta
  chromeView.setBackgroundColor('#00000000') // transparente bajo el chrome (popups sobre la página)

  win.contentView.addChildView(chromeView)
  win.contentView.addChildView(overlayView)

  loadEntry(chromeView, 'chrome')
  loadEntry(overlayView, 'overlay')

  // Sincroniza estado colapsado con el overlay cuando termina de cargar.
  overlayView.webContents.on('did-finish-load', () =>
    sendOverlayState()
  )
  // Reenvía el estado completo al chrome cada vez que carga (incluye HMR/reload en
  // dev) → la tira de tabs no queda vacía tras un reload del renderer.
  chromeView.webContents.on('did-finish-load', () => {
    sendTabs()
    sendNavState()
    sendBookmarks()
    sendHistory()
    sendViewport()
    sendSecurityState()
  })

  // Atajos globales: la barra propia y el overlay también deben responder cuando
  // tienen el foco (no solo la página). Las pestañas se enganchan en wireTabEvents.
  attachShortcuts(chromeView.webContents)
  attachShortcuts(overlayView.webContents)

  // Bus → overlay (IPC). Único puente main→UI de observabilidad.
  bus.onEvent((evt) => overlayView.webContents.send(IPC.event, evt))

  win.on('resize', refreshViewportLayout)

  // Restaura la sesión: reabre las pestañas que estaban abiertas (o una nueva).
  const s = loadSession()
  const restoredViewport = s.viewport ? resolveViewport(s.viewport) : null
  if (restoredViewport) viewport = restoredViewport
  if (s.tabs.length > 0) {
    s.tabs.forEach((u) => createTab(/^https?:/i.test(u) ? u : START_URL, false))
    const target = tabs[s.activeIndex] ?? tabs[0]
    if (target) activateTab(target.id)
  } else {
    createTab(START_URL)
  }
  restoring = false // a partir de acá, los cambios sí se persisten
  storeSession()
  layout()
  registerIpc()
}

function registerIpc(): void {
  ipcMain.on(IPC.historyClear, () => {
    clearHistory()
    sendHistory()
  })

  // Expande/contrae el chrome para popups que deben flotar sobre la página.
  ipcMain.on(IPC.chromeExpand, (_e, open: boolean) => {
    chromeExpanded = open
    // A modal picker must remain above the observability panel, including input.
    win.contentView.addChildView(open ? chromeView : overlayView)
    layout()
  })

  ipcMain.on(IPC.navigate, (_e, url: string) => {
    activeTab()?.view.webContents.loadURL(normUrl(url)).catch((err) => console.error('[nav]', err))
  })

  ipcMain.on(IPC.navAction, (_e, action: NavAction) => {
    const wc = activeTab()?.view.webContents
    if (!wc) return
    const h = wc.navigationHistory
    if (action === 'back' && h.canGoBack()) h.goBack()
    else if (action === 'forward' && h.canGoForward()) h.goForward()
    else if (action === 'reload') wc.reload()
    else if (action === 'stop') wc.stop()
  })

  // ---- pestañas ----
  ipcMain.on(IPC.tabNew, () => createTab(START_URL))
  ipcMain.on(IPC.tabClose, (_e, id: string) => closeTab(id))
  ipcMain.on(IPC.tabActivate, (_e, id: string) => activateTab(id))

  // ---- viewports / device modes ----
  ipcMain.handle(IPC.viewportSet, async (e, p: ViewportSet): Promise<ViewportApplyResult> => {
    if (e.sender !== chromeView.webContents) {
      return { ok: false, state: viewportState(), error: 'Origen no autorizado.' }
    }
    return setViewport(p)
  })

  ipcMain.handle(IPC.exportSession, async (e, payload: SessionExport): Promise<ExportResult> => {
    if ((e.sender !== overlayView.webContents && e.sender !== chromeView.webContents) || !isSessionExport(payload)) {
      return { canceled: false, error: 'Exportación no autorizada o inválida.' }
    }
    const target = await dialog.showSaveDialog(win, {
      title: 'Exportar sesión',
      defaultPath: payload.filename,
      filters: [{ name: payload.format === 'har' ? 'HAR' : 'JSON', extensions: [payload.format] }]
    })
    if (target.canceled || !target.filePath) return { canceled: true }
    try {
      await writeFile(target.filePath, JSON.stringify(payload.payload, null, 2), 'utf8')
      return { canceled: false, path: target.filePath }
    } catch (err) {
      return { canceled: false, error: (err as Error).message }
    }
  })

  ipcMain.handle(IPC.appInfo, (): AppInfo => ({
    name: app.getName(), version: app.getVersion(),
    defaultBrowserRegistered: app.isDefaultProtocolClient('http') && app.isDefaultProtocolClient('https')
  }))
  ipcMain.handle(IPC.defaultBrowserSet, (_e, enabled: boolean): AppInfo => {
    if (typeof enabled === 'boolean') {
      if (enabled) {
        app.setAsDefaultProtocolClient('http')
        app.setAsDefaultProtocolClient('https')
      } else {
        app.removeAsDefaultProtocolClient('http')
        app.removeAsDefaultProtocolClient('https')
      }
    }
    return {
      name: app.getName(), version: app.getVersion(),
      defaultBrowserRegistered: app.isDefaultProtocolClient('http') && app.isDefaultProtocolClient('https')
    }
  })

  ipcMain.handle(IPC.securitySetEnabled, async (e, enabled: boolean): Promise<SecurityActionResult> => {
    if (e.sender !== overlayView.webContents || typeof enabled !== 'boolean') {
      return { ok: false, state: securityState(), error: 'Origen no autorizado.' }
    }
    const controller = activeTab()?.cdp?.security
    if (!controller) return { ok: false, state: securityState(), error: 'CDP no está disponible en esta pestaña.' }
    const result = await controller.setEnabled(enabled)
    sendSecurityState()
    return result
  })
  ipcMain.handle(IPC.securityRules, async (e, rules: unknown): Promise<SecurityActionResult> => {
    if (e.sender !== overlayView.webContents) return { ok: false, state: securityState(), error: 'Origen no autorizado.' }
    const controller = activeTab()?.cdp?.security
    if (!controller) return { ok: false, state: securityState(), error: 'CDP no está disponible en esta pestaña.' }
    const result = await controller.setRules(parseRules(rules))
    sendSecurityState()
    return result
  })
  ipcMain.handle(IPC.securityAction, async (e, action: SecurityAction): Promise<SecurityActionResult> => {
    if (e.sender !== overlayView.webContents) return { ok: false, state: securityState(), error: 'Origen no autorizado.' }
    const controller = activeTab()?.cdp?.security
    if (!controller) return { ok: false, state: securityState(), error: 'CDP no está disponible en esta pestaña.' }
    const result = await controller.act(action)
    sendSecurityState()
    return result
  })

  // ---- find in page (Ctrl+F) ----
  ipcMain.on(IPC.findQuery, (_e, q: FindQuery) => {
    const wc = activeTab()?.view.webContents
    if (!wc || wc.isDestroyed()) return
    if (!q.text) {
      wc.stopFindInPage('clearSelection')
      chromeView.webContents.send(IPC.findResult, { matches: 0, active: 0 })
      return
    }
    wc.findInPage(q.text, { forward: q.forward, findNext: q.findNext, matchCase: q.matchCase })
  })
  ipcMain.on(IPC.findStop, () => {
    const wc = activeTab()?.view.webContents
    if (wc && !wc.isDestroyed()) wc.stopFindInPage('clearSelection')
  })

  // ---- bookmarks ----
  ipcMain.on(IPC.bookmarkToggle, () => {
    const wc = activeTab()?.view.webContents
    if (!wc) return
    toggleBookmark(wc.getURL(), wc.getTitle())
    sendBookmarks()
  })
  ipcMain.on(IPC.bookmarkOpen, (_e, url: string) => {
    activeTab()?.view.webContents.loadURL(normUrl(url)).catch((err) => console.error('[nav]', err))
  })
  ipcMain.on(IPC.bookmarkRemove, (_e, id: string) => {
    removeBookmark(id)
    sendBookmarks()
  })
  ipcMain.on(IPC.bookmarksBarToggle, () => {
    toggleBar()
    refreshViewportLayout() // el alto del chrome cambió
    sendBookmarks()
  })

  ipcMain.on(IPC.overlayControl, (_e, control: OverlayControl) => {
    if (control === 'collapse') overlayCollapsed = true
    else if (control === 'expand') overlayCollapsed = false
    else if (control === 'toggle') overlayCollapsed = !overlayCollapsed
    layout()
    sendOverlayState()
  })

  // Body de respuesta on-demand (REQ-020). CDP lo retiene hasta navegar.
  ipcMain.handle(IPC.getResponseBody, async (_e, requestId: string): Promise<ResponseBody> => {
    const wc = activeTab()?.view.webContents
    if (!wc) return { body: '— sin pestaña activa —', base64: false }
    try {
      const res = (await wc.debugger.sendCommand('Network.getResponseBody', {
        requestId
      })) as { body: string; base64Encoded: boolean }
      return { body: res.body, base64: res.base64Encoded }
    } catch (err) {
      return { body: `— no disponible (${(err as Error).message}) —`, base64: false }
    }
  })

  // Detalle de storage del origen activo (cookies + items de local/session storage).
  ipcMain.handle(IPC.getStorageDetail, async (): Promise<StorageDetail> => {
    const empty: StorageDetail = { origin: '', cookies: [], local: [], session: [] }
    const wc = activeTab()?.view.webContents
    if (!wc) return empty
    const url = wc.getURL()
    let origin = ''
    try {
      origin = new URL(url).origin
    } catch {
      return empty
    }
    if (!/^https?:/.test(origin)) return { ...empty, origin }
    const dbg = wc.debugger

    const getDom = async (isLocal: boolean): Promise<StorageKV[]> => {
      try {
        const r = (await dbg.sendCommand('DOMStorage.getDOMStorageItems', {
          storageId: { securityOrigin: origin, isLocalStorage: isLocal }
        })) as { entries: [string, string][] }
        return (r.entries ?? []).map(([key, value]) => ({ key, value }))
      } catch {
        return []
      }
    }

    // Cookies vía la API nativa de Electron (scope automático al sitio, incluye
    // httpOnly que `document.cookie` no ve). Más fiable que CDP para esto.
    const host = (() => {
      try {
        return new URL(url).hostname
      } catch {
        return ''
      }
    })()
    const cookies = await wc.session.cookies
      .get({ url })
      .then((list) =>
        list.map((c) => ({
          name: c.name,
          value: c.value,
          domain: c.domain ?? host,
          path: c.path ?? '/',
          size: c.name.length + c.value.length,
          httpOnly: !!c.httpOnly,
          secure: !!c.secure,
          expires: c.session ? -1 : c.expirationDate ?? -1
        }))
      )
      .catch(() => [])

    const [local, session] = await Promise.all([getDom(true), getDom(false)])
    return { origin, cookies, local, session }
  })

  // Arrastre del overlay: acumula deltas de pantalla sobre la posición actual.
  ipcMain.on(IPC.overlayMove, (_e, dx: number, dy: number) => {
    const { width, height } = win.getContentBounds()
    const o = overlayCollapsed ? OVERLAY_COLLAPSED : overlaySize
    const cur = overlayPos ?? cornerPos(width, height, o)
    overlayPos = {
      x: clamp(cur.x + dx, 0, width - o.w),
      y: clamp(cur.y + dy, chromeHeight(), height - o.h)
    }
    layout()
  })

  // Resize desde la esquina superior-izquierda: crece hacia arriba/izquierda
  // manteniendo fija la esquina inferior-derecha (anclaje natural del panel).
  ipcMain.on(IPC.overlayResize, (_e, dx: number, dy: number) => {
    if (overlayCollapsed) return
    const { width, height } = win.getContentBounds()
    const cur = overlayPos ?? cornerPos(width, height, overlaySize)
    const newW = clamp(overlaySize.w - dx, OVERLAY_MIN.w, Math.min(OVERLAY_MAX.w, width))
    const newH = clamp(overlaySize.h - dy, OVERLAY_MIN.h, Math.min(OVERLAY_MAX.h, height - chromeHeight()))
    overlayPos = { x: cur.x + (overlaySize.w - newW), y: cur.y + (overlaySize.h - newH) }
    overlaySize = { w: newW, h: newH }
    layout()
  })
}

// Resuelve un preset/custom/fit → estado de viewport, relayoutea y re-emula.
async function setViewport(p: ViewportSet): Promise<ViewportApplyResult> {
  const next = resolveViewport(p)
  if (!next) {
    viewportError = 'Tamano invalido: usa enteros de 200 a 7680 px y DPR de 0.5 a 4.'
    sendViewport()
    return { ok: false, state: viewportState(), error: viewportError }
  }
  viewport = next
  viewportError = undefined
  layout()
  const wc = activeTab()?.view.webContents
  if (wc) await applyEmulation(wc)
  // Dispatch a second native resize after the metrics override settles.
  layout()
  sendViewport()
  sendNavState() // las dims del viewport cambiaron
  storeSession()
  return viewportError
    ? { ok: false, state: viewportState(), error: viewportError }
    : { ok: true, state: viewportState() }
}

function isSessionExport(value: unknown): value is SessionExport {
  if (!value || typeof value !== 'object') return false
  const v = value as SessionExport
  return (v.format === 'har' || v.format === 'json') &&
    typeof v.filename === 'string' && v.filename.length > 0 && v.filename.length < 200
}

// ---- atajos de teclado (before-input-event, REQ-026) ----
// Se engancha a cada webContents (chrome, overlay y cada página): el atajo responde
// tenga el foco donde tenga. preventDefault evita que Chromium también lo procese.
function cycleTab(dir: 1 | -1): void {
  if (tabs.length < 2) return
  const i = tabs.findIndex((t) => t.id === activeId)
  activateTab(tabs[(i + dir + tabs.length) % tabs.length].id)
}
function activateByIndex(n: number): void {
  // 1..8 → esa pestaña; 9 → última (convención de navegadores).
  const idx = n === 9 ? tabs.length - 1 : n - 1
  if (idx >= 0 && idx < tabs.length) activateTab(tabs[idx].id)
}
function attachShortcuts(wc: WebContents): void {
  wc.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    const mod = input.control || input.meta
    const shift = input.shift
    const key = input.key.toLowerCase()
    const page = (): WebContents | undefined => activeTab()?.view.webContents
    let handled = true

    if (key === 'f5' || (mod && !shift && key === 'r')) page()?.reload()
    else if (mod && shift && key === 'r') page()?.reloadIgnoringCache()
    else if (mod && !shift && key === 't') createTab(START_URL)
    else if (mod && !shift && key === 'w') closeTab(activeId)
    else if (mod && key === 'tab') cycleTab(shift ? -1 : 1)
    else if (mod && !shift && /^[1-9]$/.test(key)) activateByIndex(Number(key))
    else if ((mod && key === 'l') || (input.alt && key === 'd')) chromeView.webContents.send(IPC.focusAddress)
    else if (mod && shift && key === 'm') chromeView.webContents.send(IPC.viewportShow)
    else if (mod && !shift && key === 'd') {
      const w = page()
      if (w) { toggleBookmark(w.getURL(), w.getTitle()); sendBookmarks() }
    } else if (mod && !shift && key === 'b') { toggleBar(); refreshViewportLayout(); sendBookmarks() }
    else if (mod && shift && key === 'o') {
      overlayCollapsed = !overlayCollapsed
      layout()
      sendOverlayState()
    } else if (mod && !shift && key === 'p') {
      const w = page()
      if (w && !w.isDestroyed()) w.print()
    } else if (mod && !shift && key === 'f') {
      chromeView.webContents.send(IPC.findShow)
    } else handled = false

    if (handled) event.preventDefault()
  })
}

export function focusPage(): WebContents | undefined {
  return activeTab()?.view.webContents
}
