import { DEVICE_PRESETS, resolveViewport, type ViewportConfig } from './viewport'

export const VIEWPORT_LIBRARY_KEY = 'overrun.viewport-library.v1'
export const MAX_SAVED_VIEWPORTS = 50

export interface SavedViewport {
  id: string
  name: string
  config: ViewportConfig
}

export interface ViewportLibrary {
  favorites: string[]
  saved: SavedViewport[]
}

export function parseViewportLibrary(raw: string | null): ViewportLibrary {
  const empty = { favorites: [], saved: [] }
  if (!raw) return empty
  try {
    const value = JSON.parse(raw)
    if (!value || typeof value !== 'object') return empty
    const saved: SavedViewport[] = []
    if (Array.isArray(value.saved)) {
      for (const item of value.saved.slice(0, MAX_SAVED_VIEWPORTS)) {
        if (!item || typeof item.id !== 'string' || !item.id.startsWith('saved-') ||
          typeof item.name !== 'string' || !item.name.trim() || saved.some((s) => s.id === item.id)) continue
        const config = resolveViewport(item.config)
        if (config?.presetId !== 'custom') continue
        saved.push({ id: item.id, name: item.name.trim().slice(0, 48), config })
      }
    }
    const allowed = new Set([...DEVICE_PRESETS.map((d) => d.id), ...saved.map((s) => s.id)])
    const favorites = Array.isArray(value.favorites)
      ? [...new Set<string>(value.favorites.filter((id: unknown) => typeof id === 'string' && allowed.has(id)))] : []
    return { favorites, saved }
  } catch {
    return empty
  }
}
