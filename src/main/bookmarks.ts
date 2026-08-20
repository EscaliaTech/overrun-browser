import { app } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Bookmark } from '../shared/events'

// ============================================================================
// Store de bookmarks — persistido como JSON en la carpeta de datos de la app
// (userData), así sobreviven reinicios. La barra retráctil guarda su estado acá
// mismo para reabrir la app como se dejó.
// ============================================================================

interface Store {
  items: Bookmark[]
  barVisible: boolean
}

const file = (): string => join(app.getPath('userData'), 'bookmarks.json')
let cache: Store | null = null
let seq = 0

function load(): Store {
  if (cache) return cache
  try {
    const parsed = JSON.parse(readFileSync(file(), 'utf8')) as Partial<Store>
    cache = {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      barVisible: parsed.barVisible === true
    }
  } catch {
    // Primer arranque o archivo inválido: se empieza vacío.
    cache = { items: [], barVisible: false }
  }
  return cache
}

function persist(): void {
  try {
    writeFileSync(file(), JSON.stringify(load(), null, 2))
  } catch (err) {
    console.error('[bookmarks] no se pudo guardar:', err)
  }
}

// Compara URLs ignorando la barra final: guardar example.com y example.com/ es lo mismo.
const norm = (url: string): string => url.replace(/\/+$/, '')

function makeId(): string {
  return `bm-${Date.now().toString(36)}-${(seq++).toString(36)}`
}

export function listBookmarks(): Bookmark[] {
  return load().items
}

export function isBarVisible(): boolean {
  return load().barVisible
}

export function isSaved(url: string): boolean {
  return load().items.some((b) => norm(b.url) === norm(url))
}

/** Guarda la URL si no estaba; la quita si ya estaba. Devuelve el nuevo estado. */
export function toggleBookmark(url: string, title: string): boolean {
  const s = load()
  const i = s.items.findIndex((b) => norm(b.url) === norm(url))
  if (i >= 0) {
    s.items.splice(i, 1)
    persist()
    return false
  }
  s.items.push({ id: makeId(), url, title: title || url })
  persist()
  return true
}

export function removeBookmark(id: string): void {
  const s = load()
  s.items = s.items.filter((b) => b.id !== id)
  persist()
}

/** Alterna la barra retráctil y devuelve si quedó visible. */
export function toggleBar(): boolean {
  const s = load()
  s.barVisible = !s.barVisible
  persist()
  return s.barVisible
}
