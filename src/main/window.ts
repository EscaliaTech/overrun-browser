import { join } from 'node:path'
import { BaseWindow, WebContentsView, ipcMain, type WebContents } from 'electron'
import { is } from '@electron-toolkit/utils'
import { attachCdp } from './cdp/attach'
import { bus } from './events/bus'
import { IPC, type NavAction, type NavState, type OverlayControl, type ResponseBody } from '../shared/events'

// ============================================================================
// Ventana Overrun — arquitectura de dos superficies apiladas (D-003 / REQ-010,014):
//
//   BaseWindow
//   ├── chromeView   (WebContentsView) → barra + tabs (React), franja superior
//   ├── pageView     (WebContentsView) → la app inspeccionada, SIEMPRE full-size
//   └── overlayView  (WebContentsView) → panel flotante en esquina, SIEMPRE arriba
//
// El overlay NO forma parte del viewport de la página: flota encima, no la
// redimensiona (REQ-014). La página ocupa todo el alto bajo la barra de chrome
// (una toolbar de navegador no es "viewport de la página", como en cualquier browser).
// ============================================================================

const CHROME_H = 92 // tab strip (40) + toolbar (52)
const MARGIN = 26
const OVERLAY_EXPANDED = { w: 452, h: 560 }
const OVERLAY_COLLAPSED = { w: 232, h: 44 }
const START_URL = 'https://example.com'

let win: BaseWindow
let chromeView: WebContentsView
let pageView: WebContentsView
let overlayView: WebContentsView
let overlayCollapsed = false
// Posición del overlay: null = anclado a la esquina (default, responsive);
// una vez arrastrado, queda fijo en {x,y} (top-left).
let overlayPos: { x: number; y: number } | null = null

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), Math.max(lo, hi))

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
  chromeView.setBounds({ x: 0, y: 0, width, height: CHROME_H })
  pageView.setBounds({ x: 0, y: CHROME_H, width, height: height - CHROME_H })

  const o = overlayCollapsed ? OVERLAY_COLLAPSED : OVERLAY_EXPANDED
  const pos = overlayPos ?? cornerPos(width, height, o)
  overlayView.setBounds({
    x: clamp(pos.x, 0, width - o.w),
    y: clamp(pos.y, CHROME_H, height - o.h),
    width: o.w,
    height: o.h
  })
}

function sendNavState(): void {
  const wc = pageView.webContents
  const b = pageView.getBounds()
  const state: NavState = {
    url: wc.getURL(),
    canGoBack: wc.navigationHistory.canGoBack(),
    canGoForward: wc.navigationHistory.canGoForward(),
    loading: wc.isLoading(),
    viewport: { width: b.width, height: b.height }
  }
  chromeView.webContents.send(IPC.navState, state)
}

export function createWindow(): void {
  win = new BaseWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0a0b0d', // Void (BRANDING)
    title: 'Overrun'
  })

  const uiPrefs = { preload: join(__dirname, '../preload/index.js'), sandbox: true, contextIsolation: true }

  // Orden de addChildView = z-order. Página abajo, chrome, overlay arriba de todo.
  pageView = new WebContentsView({
    webPreferences: { sandbox: true, contextIsolation: true } // sin preload: web no confiable
  })
  chromeView = new WebContentsView({ webPreferences: uiPrefs })
  overlayView = new WebContentsView({ webPreferences: uiPrefs })
  overlayView.setBackgroundColor('#00000000') // transparente donde el panel no pinta

  win.contentView.addChildView(pageView)
  win.contentView.addChildView(chromeView)
  win.contentView.addChildView(overlayView)

  loadEntry(chromeView, 'chrome')
  loadEntry(overlayView, 'overlay')
  pageView.webContents.loadURL(START_URL)

  // Sincroniza estado colapsado con el overlay cuando termina de cargar.
  overlayView.webContents.on('did-finish-load', () =>
    overlayView.webContents.send(IPC.overlayState, overlayCollapsed)
  )
  // Manda estado inicial (url + resolución) al chrome cuando carga.
  chromeView.webContents.on('did-finish-load', sendNavState)

  // CDP sobre la PÁGINA (D-002). El overlay se alimenta del bus, no de CDP directo.
  attachCdp(pageView.webContents)

  // Bus → overlay (IPC). Único puente main→UI de observabilidad.
  bus.onEvent((evt) => overlayView.webContents.send(IPC.event, evt))

  // Estado de navegación → chrome.
  const wc = pageView.webContents
  wc.on('did-navigate', sendNavState)
  wc.on('did-navigate-in-page', sendNavState)
  wc.on('did-start-loading', sendNavState)
  wc.on('did-stop-loading', sendNavState)

  win.on('resize', () => {
    layout()
    sendNavState() // la resolución cambió
  })
  layout()
  registerIpc()
}

function registerIpc(): void {
  ipcMain.on(IPC.navigate, (_e, url: string) => {
    const target = /^https?:\/\//i.test(url) ? url : `https://${url}`
    pageView.webContents.loadURL(target).catch((err) => console.error('[nav]', err))
  })

  ipcMain.on(IPC.navAction, (_e, action: NavAction) => {
    const wc = pageView.webContents
    const h = wc.navigationHistory
    if (action === 'back' && h.canGoBack()) h.goBack()
    else if (action === 'forward' && h.canGoForward()) h.goForward()
    else if (action === 'reload') wc.reload()
    else if (action === 'stop') wc.stop()
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
    try {
      const res = (await pageView.webContents.debugger.sendCommand('Network.getResponseBody', {
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
    const o = overlayCollapsed ? OVERLAY_COLLAPSED : OVERLAY_EXPANDED
    const cur = overlayPos ?? cornerPos(width, height, o)
    overlayPos = {
      x: clamp(cur.x + dx, 0, width - o.w),
      y: clamp(cur.y + dy, CHROME_H, height - o.h)
    }
    layout()
  })
}

export function focusPage(): WebContents {
  return pageView.webContents
}
