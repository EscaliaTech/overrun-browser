import { app } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { HistoryEntry } from '../shared/events'

// ============================================================================
// Historial de navegación — persistido como JSON en userData (mismo patrón que
// bookmarks). Sobrevive reinicios; alimenta las sugerencias de la barra.
// ============================================================================

const MAX = 500
const file = (): string => join(app.getPath('userData'), 'history.json')
let cache: HistoryEntry[] | null = null

function load(): HistoryEntry[] {
  if (cache) return cache
  try {
    const parsed = JSON.parse(readFileSync(file(), 'utf8'))
    cache = Array.isArray(parsed) ? (parsed as HistoryEntry[]) : []
  } catch {
    cache = []
  }
  return cache
}

function persist(): void {
  try {
    writeFileSync(file(), JSON.stringify(load()))
  } catch (err) {
    console.error('[history] no se pudo guardar:', err)
  }
}

/** Registra una visita. Colapsa recargas/entradas consecutivas de la misma URL. */
export function addVisit(url: string, title: string): void {
  if (!/^https?:/i.test(url)) return // about:blank y otros no entran al historial
  const h = load()
  if (h[0]?.url === url) {
    if (title) h[0].title = title
    h[0].ts = Date.now()
  } else {
    h.unshift({ url, title: title || url, ts: Date.now() })
    if (h.length > MAX) h.length = MAX
  }
  persist()
}

/** Las `n` visitas más recientes (más nueva primero). */
export function recentVisits(n: number): HistoryEntry[] {
  return load().slice(0, n)
}

export function clearHistory(): void {
  cache = []
  persist()
}
