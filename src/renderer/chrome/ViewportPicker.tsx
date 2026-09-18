import { useEffect, useRef, useState } from 'react'
import {
  DEVICE_CATEGORIES, DEVICE_PRESETS, VIEWPORT_LIMITS, resolveViewport, rotateViewport, validDimensions,
  type ViewportSet, type ViewportState
} from '../../shared/viewport'
import type { NavState } from '../../shared/events'
import {
  MAX_SAVED_VIEWPORTS, VIEWPORT_LIBRARY_KEY, parseViewportLibrary, type ViewportLibrary
} from '../../shared/viewport-library'
import './viewport.css'

interface Props {
  vp: ViewportState
  nav: NavState
  open: boolean
  setOpen: (open: boolean) => void
}

export function ViewportPicker({ vp, nav, open, setOpen }: Props): JSX.Element {
  const trigger = useRef<HTMLButtonElement>(null)
  const active = vp.presetId !== null
  return (
    <div className="vp-anchor">
      <button ref={trigger} className="vp-trigger" data-active={active} aria-expanded={open}
        aria-haspopup="dialog" aria-controls={open ? 'viewport-picker' : undefined}
        title="Multi size: dispositivos y dimensiones personalizadas" onClick={() => setOpen(!open)}>
        <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
          <rect x="1" y="2" width="10" height="8" rx="1" stroke="currentColor" fill="none" />
          <rect x="10" y="6" width="5" height="8" rx="1" stroke="currentColor" fill="none" />
          <path d="M4 13h4M6 10v3" stroke="currentColor" />
        </svg>
        <span>Multi size</span>
        <span className="vp-mono">{active ? vp.width : nav.viewport.width} x {active ? vp.height : nav.viewport.height}</span>
      </button>
      {open && <ViewportPanel vp={vp} nav={nav} onClose={() => { setOpen(false); trigger.current?.focus() }} />}
    </div>
  )
}

function ViewportPanel({ vp, nav, onClose }: Pick<Props, 'vp' | 'nav'> & { onClose: () => void }): JSX.Element {
  const panel = useRef<HTMLDivElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const importInput = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [width, setWidth] = useState(String(vp.width || nav.viewport.width))
  const [height, setHeight] = useState(String(vp.height || nav.viewport.height))
  const [dpr, setDpr] = useState(String(vp.dpr))
  const [mobile, setMobile] = useState(vp.mobile)
  const [touch, setTouch] = useState(vp.touch)
  const [name, setName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [applying, setApplying] = useState(false)
  const [library, setLibrary] = useState<ViewportLibrary>(() => {
    try { return parseViewportLibrary(localStorage.getItem(VIEWPORT_LIBRARY_KEY)) }
    catch { return { favorites: [], saved: [] } }
  })
  useEffect(() => { search.current?.focus({ preventScroll: true }) }, [])

  const persist = (next: ViewportLibrary): boolean => {
    try {
      localStorage.setItem(VIEWPORT_LIBRARY_KEY, JSON.stringify(next))
      setLibrary(next)
      return true
    } catch {
      setMessage('No se pudo guardar la biblioteca en este equipo.')
      return false
    }
  }
  const favorite = (id: string): void => {
    persist({ ...library, favorites: library.favorites.includes(id)
      ? library.favorites.filter((f) => f !== id) : [...library.favorites, id] })
  }
  const apply = async (value: ViewportSet, reload = false): Promise<void> => {
    setApplying(true)
    setMessage('')
    try {
      const result = await window.overrun.viewportSet(value)
      if (!result.ok) {
        setMessage(result.error ?? 'No se pudo aplicar el tamaño.')
        return
      }
      if (reload) window.overrun.navAction('reload')
      onClose()
    } catch {
      setMessage('No se pudo comunicar el cambio al navegador.')
    } finally {
      setApplying(false)
    }
  }
  const w = Number(width), h = Number(height), ratio = Number(dpr)
  const valid = validDimensions(w, h, ratio)
  const custom = (): ViewportSet => ({ presetId: 'custom', width: w, height: h, dpr: ratio, mobile, touch })
  const save = (): void => {
    const config = resolveViewport(custom())
    if (!config || !name.trim()) return
    if (!editingId && library.saved.length >= MAX_SAVED_VIEWPORTS) {
      setMessage(`Limite de ${MAX_SAVED_VIEWPORTS} perfiles. Elimina uno para guardar otro.`)
      return
    }
    const item = { id: editingId ?? `saved-${crypto.randomUUID()}`, name: name.trim(), config }
    const saved = editingId
      ? library.saved.map((profile) => profile.id === editingId ? item : profile)
      : [...library.saved, item]
    if (persist({ ...library, saved })) {
      setName('')
      setEditingId(null)
      setMessage(editingId ? `Actualizado: ${item.name}` : `Guardado: ${item.name}`)
    }
  }
  const edit = (id: string): void => {
    const profile = library.saved.find((saved) => saved.id === id)
    if (!profile) return
    const { config } = profile
    setWidth(String(config.width)); setHeight(String(config.height)); setDpr(String(config.dpr))
    setMobile(config.mobile); setTouch(config.touch); setName(profile.name); setEditingId(id)
    setMessage(`Editando: ${profile.name}`)
  }
  const exportLibrary = async (): Promise<void> => {
    const result = await window.overrun.exportSession({
      filename: 'overrun-multi-size.json', format: 'json',
      payload: { version: 1, exportedAt: new Date().toISOString(), library }
    })
    setMessage(result.error ? `No se pudo exportar: ${result.error}` : result.canceled ? '' : 'Biblioteca exportada.')
  }
  const importLibrary = async (file: File | undefined): Promise<void> => {
    if (!file) return
    try {
      const value = JSON.parse(await file.text())
      const imported = parseViewportLibrary(JSON.stringify(value.library ?? value))
      const byId = new Map([...library.saved, ...imported.saved].map((item) => [item.id, item]))
      const saved = [...byId.values()].slice(0, MAX_SAVED_VIEWPORTS)
      const allowed = new Set(saved.map((item) => item.id))
      const favorites = [...new Set([...library.favorites, ...imported.favorites])]
        .filter((id) => DEVICE_PRESETS.some((preset) => preset.id === id) || allowed.has(id))
      if (persist({ saved, favorites })) setMessage(`${imported.saved.length} perfiles importados.`)
    } catch {
      setMessage('El archivo no contiene una biblioteca Multi size válida.')
    }
  }
  const all = [
    ...DEVICE_PRESETS.map((d) => ({ id: d.id, label: d.label, category: d.category as string,
      w: d.w, h: d.h, dpr: d.dpr, touch: d.touch, mobile: d.mobile,
      payload: { presetId: d.id } as ViewportSet })),
    ...library.saved.map((s) => ({ id: s.id, label: s.name, category: 'saved',
      w: s.config.width, h: s.config.height, dpr: s.config.dpr, touch: s.config.touch, mobile: s.config.mobile,
      payload: s.config as ViewportSet }))
  ]
  const q = query.trim().toLocaleLowerCase()
  const filtered = all.filter((d) => {
    const group = DEVICE_CATEGORIES.find((c) => c.id === d.category)?.label ?? 'Guardados'
    return (category === 'all' || category === d.category || (category === 'favorites' && library.favorites.includes(d.id))) &&
      `${d.label} ${d.w}x${d.h} ${group}`.toLocaleLowerCase().includes(q)
  })
  const selectedLabel = DEVICE_PRESETS.find((d) => d.id === vp.presetId)?.label ??
    (vp.presetId === null ? 'Ajustar a ventana' : 'Personalizado')

  return (
    <>
      <div className="vp-backdrop" onClick={onClose} />
      <div ref={panel} id="viewport-picker" className="vp-panel" role="dialog" aria-modal="true" aria-labelledby="vp-title"
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose() }
          if (e.key === 'Tab') {
            const elements = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select')
            if (!elements?.length) return
            const first = elements[0], last = elements[elements.length - 1]
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
          }
        }}>
        <header className="vp-header">
          <div><h2 id="vp-title">Multi size</h2><p>{DEVICE_PRESETS.length} perfiles de pantalla + tus medidas</p></div>
          <button className="vp-icon" onClick={onClose} aria-label="Cerrar selector">X</button>
        </header>
        <div className="vp-current">
          <div><strong>{selectedLabel}</strong><span className="vp-mono">
            {vp.width || nav.viewport.width} x {vp.height || nav.viewport.height} CSS px
            {' / '}DPR {vp.dpr}{' / '}vista {Math.round(vp.scale * 100)}%
          </span></div>
          <button disabled={vp.presetId === null || applying} onClick={() => void apply(rotateViewport(vp))}>Rotar</button>
          <button disabled={applying} onClick={() => void apply({ presetId: null })}>Ventana</button>
        </div>
        {vp.error && <p className="vp-error" role="alert">{vp.error}</p>}
        <div className="vp-workspace">
          <section className="vp-catalog" aria-label="Catalogo de dispositivos">
            <input ref={search} type="search" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar dispositivo o resolucion..." aria-label="Buscar dispositivo o resolucion" />
            <div className="vp-filters" aria-label="Categorias">
              {[{ id: 'all', label: 'Todos' }, { id: 'favorites', label: 'Favoritos' },
                { id: 'saved', label: 'Guardados' }, ...DEVICE_CATEGORIES].map((c) => (
                <button key={c.id} aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>{c.label}</button>
              ))}
            </div>
            <p className="vp-count" role="status">{filtered.length} tamanos disponibles</p>
            <div className="vp-results">
              {filtered.length === 0 && <div className="vp-empty">No hay tamanos en esta seleccion. Prueba otra busqueda o guarda tus propias medidas.</div>}
              {filtered.map((d) => {
                const selected = d.id === vp.presetId || (d.category === 'saved' && vp.presetId === 'custom' &&
                  d.w === vp.width && d.h === vp.height && d.dpr === vp.dpr && d.mobile === vp.mobile && d.touch === vp.touch)
                return (
                  <div key={d.id} className="vp-device" data-selected={selected}>
                    <button className="vp-device-pick" aria-pressed={selected} disabled={applying} onClick={() => void apply(d.payload)}>
                      <span className="vp-device-outline" aria-hidden="true"
                        style={{ width: d.w >= d.h ? 26 : Math.max(10, 26 * d.w / d.h),
                          height: d.h >= d.w ? 26 : Math.max(10, 26 * d.h / d.w) }} />
                      <span className="vp-device-label"><strong>{d.label}</strong>
                        <span className="vp-mono">{d.w} x {d.h} / {d.dpr}x{d.touch ? ' / touch' : ''}</span></span>
                    </button>
                    <button className="vp-icon" aria-label={`Favorito: ${d.label}`} aria-pressed={library.favorites.includes(d.id)}
                      onClick={() => favorite(d.id)}>
                      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                        <path d="m8 1 2 4.5 5 .5-3.8 3.3 1.1 4.9L8 11.6l-4.3 2.6 1.1-4.9L1 6l5-.5Z"
                          stroke="currentColor" fill={library.favorites.includes(d.id) ? 'currentColor' : 'none'} />
                      </svg>
                    </button>
                    {d.category === 'saved' && <button className="vp-icon" aria-label={`Eliminar ${d.label}`}
                      onClick={() => {
                        if (persist({ saved: library.saved.filter((s) => s.id !== d.id),
                          favorites: library.favorites.filter((id) => id !== d.id) })) setMessage(`Eliminado: ${d.label}`)
                      }}>X</button>}
                    {d.category === 'saved' && <button className="vp-icon" aria-label={`Editar ${d.label}`}
                      onClick={() => edit(d.id)}>E</button>}
                  </div>
                )
              })}
            </div>
          </section>
          <form className="vp-custom" onSubmit={(e) => { e.preventDefault(); if (valid) void apply(custom()) }}>
            <h3>Tu pantalla</h3>
            <p>Dimensiones exactas en CSS px.</p>
            <div className="vp-dimensions">
              <label>Ancho<input type="number" min={VIEWPORT_LIMITS.min} max={VIEWPORT_LIMITS.max} step="1"
                required value={width} onChange={(e) => setWidth(e.target.value)} aria-describedby="vp-limits" /></label>
              <button type="button" className="vp-swap" aria-label="Intercambiar ancho y alto"
                onClick={() => { setWidth(height); setHeight(width) }}>
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M2 5h12l-3-3M14 11H2l3 3" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <label>Alto<input type="number" min={VIEWPORT_LIMITS.min} max={VIEWPORT_LIMITS.max} step="1"
                required value={height} onChange={(e) => setHeight(e.target.value)} aria-describedby="vp-limits" /></label>
            </div>
            <label>Densidad de pixeles (DPR)<input type="number" min="0.5" max="4" step="any"
              required value={dpr} onChange={(e) => setDpr(e.target.value)} /></label>
            <label className="vp-check"><input type="checkbox" checked={mobile}
              onChange={(e) => setMobile(e.target.checked)} /> Layout movil</label>
            <label className="vp-check"><input type="checkbox" checked={touch}
              onChange={(e) => setTouch(e.target.checked)} /> Entrada tactil</label>
            <p id="vp-limits" className={valid ? 'vp-help' : 'vp-error'}>
              200 a 7680 px por lado. DPR de 0.5 a 4.
            </p>
            <button className="vp-primary" type="submit" disabled={!valid || applying}>{applying ? 'Aplicando...' : 'Aplicar tamano'}</button>
            <button type="button" disabled={!valid || applying} onClick={() => void apply(custom(), true)}>
              Aplicar y recargar
            </button>
            <div className="vp-save">
              <label>Guardar perfil<input value={name} maxLength={48} onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Dashboard de oficina" /></label>
              <button type="button" disabled={!valid || !name.trim() || (!editingId && library.saved.length >= MAX_SAVED_VIEWPORTS)}
                onClick={save}>{editingId ? 'Actualizar' : `Guardar (${library.saved.length}/${MAX_SAVED_VIEWPORTS})`}</button>
              {editingId && <button type="button" onClick={() => { setEditingId(null); setName(''); setMessage('Edición cancelada.') }}>Cancelar edición</button>}
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={() => void exportLibrary()}>Exportar</button>
                <button type="button" onClick={() => importInput.current?.click()}>Importar</button>
                <input ref={importInput} type="file" accept="application/json,.json" hidden
                  onChange={(e) => { void importLibrary(e.target.files?.[0]); e.currentTarget.value = '' }} />
              </div>
            </div>
            <p className={message ? 'vp-error' : 'vp-help'} role="status">
              {message || '“Aplicar y recargar” inicia la próxima petición con el User-Agent del perfil.'}
            </p>
          </form>
        </div>
        <footer className="vp-footer">Escala automatica sin recortar el viewport. Perfiles de referencia: no simulan Safari, hardware ni bisagras. El UA se aplica a proximas peticiones.</footer>
      </div>
    </>
  )
}
