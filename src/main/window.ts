import { join } from 'node:path'
import { BaseWindow, WebContentsView, ipcMain, type WebContents } from 'electron'
import { is } from '@electron-toolkit/utils'
import { attachCdp } from './cdp/attach'
import { bus } from './events/bus'
import {
  IPC,
  type NavAction,
  type NavState,
  type OverlayControl,
  type ResponseBody,
  type TabsState,
  type BookmarksState,
  type HistoryState
} from '../shared/events'
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

// ============================================================================
// Ventana Overrun — arquitectura de dos superficies apiladas (D-003 / REQ-010,014):
//
//   BaseWindow
//   ├── pageView[activa] (WebContentsView) → la app inspeccionada, SIEMPRE full-size
//   ├── chromeView       (WebContentsView) → barra + tabs (React), franja superior
//   └── overlayView      (WebContentsView) → panel flotante en esquina, SIEMPRE arriba
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
  disposeCdp: (() => void) | null
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

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), Math.max(lo, hi))

function activeTab(): Tab | undefined {
  return tabs.find((t) => t.id === activeId)
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
  if (at) at.view.setBounds({ x: 0, y: ch, width, height: height - ch })

  const o = overlayCollapsed ? OVERLAY_COLLAPSED : overlaySize
  const pos = overlayPos ?? cornerPos(width, height, o)
  overlayView.setBounds({
    x: clamp(pos.x, 0, width - o.w),
    y: clamp(pos.y, ch, height - o.h),
    width: o.w,
    height: o.h
  })
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
    viewport: { width: b.width, height: b.height }
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

// Persiste las pestañas abiertas (URLs + activa). No guarda durante el arranque
// (antes de restaurar) para no pisar la sesión con una lista vacía.
let restoring = true
function storeSession(): void {
  if (restoring) return
  saveSession({
    tabs: tabs.map((t) => t.view.webContents.getURL()),
    activeIndex: Math.max(0, tabs.findIndex((t) => t.id === activeId))
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
}

function normUrl(url: string): string {
  return /^(https?|about|file):/i.test(url) ? url : `https://${url}`
}

function createTab(url: string = START_URL, activate = true): void {
  const view = new WebContentsView({
    webPreferences: { sandbox: true, contextIsolation: true } // sin preload: web no confiable
  })
  const tab: Tab = { id: `tab-${(tabSeq++).toString(36)}`, view, disposeCdp: null }
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
    if (prev.disposeCdp) {
      prev.disposeCdp()
      prev.disposeCdp = null
    }
    win.contentView.removeChildView(prev.view)
  }

  activeId = id
  // Índice 0 = fondo del z-order: la página queda bajo chrome y overlay.
  win.contentView.addChildView(next.view, 0)
  if (!next.disposeCdp) next.disposeCdp = attachCdp(next.view.webContents)

  layout()
  sendTabs()
  sendNavState()
  sendBookmarks()
  sendHistory()
  storeSession()
}

function closeTab(id: string): void {
  const idx = tabs.findIndex((t) => t.id === id)
  if (idx < 0) return
  const tab = tabs[idx]
  const wasActive = tab.id === activeId

  if (tab.disposeCdp) {
    tab.disposeCdp()
    tab.disposeCdp = null
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
    overlayView.webContents.send(IPC.overlayState, overlayCollapsed)
  )
  // Reenvía el estado completo al chrome cada vez que carga (incluye HMR/reload en
  // dev) → la tira de tabs no queda vacía tras un reload del renderer.
  chromeView.webContents.on('did-finish-load', () => {
    sendTabs()
    sendNavState()
    sendBookmarks()
    sendHistory()
  })

  // Bus → overlay (IPC). Único puente main→UI de observabilidad.
  bus.onEvent((evt) => overlayView.webContents.send(IPC.event, evt))

  win.on('resize', () => {
    layout()
    sendNavState() // la resolución cambió
  })

  // Restaura la sesión: reabre las pestañas que estaban abiertas (o una nueva).
  const s = loadSession()
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
    layout() // el alto del chrome cambió
    sendBookmarks()
  })

  ipcMain.on(IPC.overlayControl, (_e, control: OverlayControl) => {
    if (control === 'collapse') overlayCollapsed = true
    else if (control === 'expand') overlayCollapsed = false
    else if (control === 'toggle') overlayCollapsed = !overlayCollapsed
    // 'toggle-clickthrough' → v1 (REQ-013 / D-017): pendiente de implementación.
    layout()
    overlayView.webContents.send(IPC.overlayState, overlayCollapsed)
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

export function focusPage(): WebContents | undefined {
  return activeTab()?.view.webContents
}
