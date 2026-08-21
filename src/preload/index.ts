import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC,
  type NavAction,
  type NavState,
  type OverlayControl,
  type OverrunEvent,
  type ResponseBody,
  type TabsState,
  type BookmarksState,
  type HistoryState,
  type StorageDetail,
  type ViewportState,
  type ViewportSet,
  type FindQuery,
  type FindResult
} from '../shared/events'

// ============================================================================
// Preload — expone una API mínima y tipada a los renderers (chrome / overlay).
// contextIsolation + sandbox: el renderer nunca toca Node ni ipcRenderer directo.
// ============================================================================

const api = {
  // ---- overlay: recibe eventos de observabilidad del bus (D-013) ----
  onEvent(fn: (evt: OverrunEvent) => void): () => void {
    const listener = (_e: unknown, evt: OverrunEvent): void => fn(evt)
    ipcRenderer.on(IPC.event, listener)
    return () => ipcRenderer.off(IPC.event, listener)
  },

  // ---- chrome: navegación ----
  navigate(url: string): void {
    ipcRenderer.send(IPC.navigate, url)
  },
  navAction(action: NavAction): void {
    ipcRenderer.send(IPC.navAction, action)
  },
  onNavState(fn: (state: NavState) => void): () => void {
    const listener = (_e: unknown, state: NavState): void => fn(state)
    ipcRenderer.on(IPC.navState, listener)
    return () => ipcRenderer.off(IPC.navState, listener)
  },

  // ---- chrome: pestañas ----
  tabNew(): void {
    ipcRenderer.send(IPC.tabNew)
  },
  tabClose(id: string): void {
    ipcRenderer.send(IPC.tabClose, id)
  },
  tabActivate(id: string): void {
    ipcRenderer.send(IPC.tabActivate, id)
  },
  onTabsState(fn: (state: TabsState) => void): () => void {
    const listener = (_e: unknown, state: TabsState): void => fn(state)
    ipcRenderer.on(IPC.tabsState, listener)
    return () => ipcRenderer.off(IPC.tabsState, listener)
  },

  // ---- chrome: bookmarks ----
  bookmarkToggle(): void {
    ipcRenderer.send(IPC.bookmarkToggle)
  },
  bookmarkOpen(url: string): void {
    ipcRenderer.send(IPC.bookmarkOpen, url)
  },
  bookmarkRemove(id: string): void {
    ipcRenderer.send(IPC.bookmarkRemove, id)
  },
  bookmarksBarToggle(): void {
    ipcRenderer.send(IPC.bookmarksBarToggle)
  },
  onBookmarksState(fn: (state: BookmarksState) => void): () => void {
    const listener = (_e: unknown, state: BookmarksState): void => fn(state)
    ipcRenderer.on(IPC.bookmarksState, listener)
    return () => ipcRenderer.off(IPC.bookmarksState, listener)
  },

  // ---- chrome: historial ----
  historyClear(): void {
    ipcRenderer.send(IPC.historyClear)
  },
  onHistoryState(fn: (state: HistoryState) => void): () => void {
    const listener = (_e: unknown, state: HistoryState): void => fn(state)
    ipcRenderer.on(IPC.historyState, listener)
    return () => ipcRenderer.off(IPC.historyState, listener)
  },

  // ---- chrome: viewports / device modes ----
  viewportSet(payload: ViewportSet): void {
    ipcRenderer.send(IPC.viewportSet, payload)
  },
  onViewportState(fn: (state: ViewportState) => void): () => void {
    const listener = (_e: unknown, state: ViewportState): void => fn(state)
    ipcRenderer.on(IPC.viewportState, listener)
    return () => ipcRenderer.off(IPC.viewportState, listener)
  },

  // ---- chrome: atajos (main → chrome: enfocar barra de direcciones) ----
  onFocusAddress(fn: () => void): () => void {
    const listener = (): void => fn()
    ipcRenderer.on(IPC.focusAddress, listener)
    return () => ipcRenderer.off(IPC.focusAddress, listener)
  },

  // ---- chrome: find in page (Ctrl+F) ----
  findQuery(q: FindQuery): void {
    ipcRenderer.send(IPC.findQuery, q)
  },
  findStop(): void {
    ipcRenderer.send(IPC.findStop)
  },
  onFindShow(fn: () => void): () => void {
    const listener = (): void => fn()
    ipcRenderer.on(IPC.findShow, listener)
    return () => ipcRenderer.off(IPC.findShow, listener)
  },
  onFindResult(fn: (r: FindResult) => void): () => void {
    const listener = (_e: unknown, r: FindResult): void => fn(r)
    ipcRenderer.on(IPC.findResult, listener)
    return () => ipcRenderer.off(IPC.findResult, listener)
  },

  // ---- overlay: control de estado (colapsar / expandir) (D-017) ----
  overlayControl(control: OverlayControl): void {
    ipcRenderer.send(IPC.overlayControl, control)
  },
  overlayMove(dx: number, dy: number): void {
    ipcRenderer.send(IPC.overlayMove, dx, dy)
  },
  overlayResize(dx: number, dy: number): void {
    ipcRenderer.send(IPC.overlayResize, dx, dy)
  },
  getResponseBody(requestId: string): Promise<ResponseBody> {
    return ipcRenderer.invoke(IPC.getResponseBody, requestId)
  },
  getStorageDetail(): Promise<StorageDetail> {
    return ipcRenderer.invoke(IPC.getStorageDetail)
  },
  chromeExpand(open: boolean): void {
    ipcRenderer.send(IPC.chromeExpand, open)
  },
  onOverlayState(fn: (collapsed: boolean) => void): () => void {
    const listener = (_e: unknown, collapsed: boolean): void => fn(collapsed)
    ipcRenderer.on(IPC.overlayState, listener)
    return () => ipcRenderer.off(IPC.overlayState, listener)
  }
}

export type OverrunApi = typeof api

contextBridge.exposeInMainWorld('overrun', api)
