import { app } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// ============================================================================
// Sesión de ventana — persiste las pestañas abiertas (URLs + cuál activa) en
// userData, para reabrir Overrun tal como se dejó. Mismo patrón JSON que bookmarks.
// ============================================================================

export interface SessionData {
  tabs: string[]
  activeIndex: number
}

const file = (): string => join(app.getPath('userData'), 'session.json')

export function loadSession(): SessionData {
  try {
    const p = JSON.parse(readFileSync(file(), 'utf8')) as Partial<SessionData>
    const tabs = Array.isArray(p.tabs) ? p.tabs.filter((u) => typeof u === 'string') : []
    const activeIndex = typeof p.activeIndex === 'number' && p.activeIndex >= 0 && p.activeIndex < tabs.length ? p.activeIndex : 0
    return { tabs, activeIndex }
  } catch {
    return { tabs: [], activeIndex: 0 }
  }
}

export function saveSession(data: SessionData): void {
  try {
    writeFileSync(file(), JSON.stringify(data))
  } catch (err) {
    console.error('[session] no se pudo guardar:', err)
  }
}
