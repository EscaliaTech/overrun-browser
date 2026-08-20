import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type NavAction, type NavState, type OverlayControl, type OverrunEvent, type ResponseBody } from '../shared/events'

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

  // ---- overlay: control de estado (colapsar / expandir) (D-017) ----
  overlayControl(control: OverlayControl): void {
    ipcRenderer.send(IPC.overlayControl, control)
  },
  overlayMove(dx: number, dy: number): void {
    ipcRenderer.send(IPC.overlayMove, dx, dy)
  },
  getResponseBody(requestId: string): Promise<ResponseBody> {
    return ipcRenderer.invoke(IPC.getResponseBody, requestId)
  },
  onOverlayState(fn: (collapsed: boolean) => void): () => void {
    const listener = (_e: unknown, collapsed: boolean): void => fn(collapsed)
    ipcRenderer.on(IPC.overlayState, listener)
    return () => ipcRenderer.off(IPC.overlayState, listener)
  }
}

export type OverrunApi = typeof api

contextBridge.exposeInMainWorld('overrun', api)
