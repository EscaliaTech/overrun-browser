import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  DEVICE_PRESETS,
  type NavState,
  type TabsState,
  type BookmarksState,
  type HistoryEntry,
  type ViewportState
} from '../../shared/events'

// Barra + tabs de Overrun (chromeView). Frameless propio (BRANDING), no la UI de Chrome.
export function Chrome(): JSX.Element {
  const [nav, setNav] = useState<NavState>({ url: '', canGoBack: false, canGoForward: false, loading: false, viewport: { width: 0, height: 0 } })
  const [draft, setDraft] = useState('')
  const [tabs, setTabs] = useState<TabsState>({ tabs: [], activeId: '' })
  const [marks, setMarks] = useState<BookmarksState>({ items: [], barVisible: false, currentSaved: false })
  // Historial completo persistido (viene del main); alimenta el autocompletado.
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [showHist, setShowHist] = useState(false)
  const [vp, setVp] = useState<ViewportState>({ presetId: null, width: 0, height: 0, dpr: 1, mobile: false, landscape: false, clamped: false })
  const [vpMenu, setVpMenu] = useState(false)
  const addrRef = useRef<HTMLInputElement>(null)

  useEffect(() => window.overrun.onNavState((s) => {
    setNav(s)
    setDraft(s.url)
  }), [])
  useEffect(() => window.overrun.onTabsState(setTabs), [])
  useEffect(() => window.overrun.onBookmarksState(setMarks), [])
  useEffect(() => window.overrun.onHistoryState((s) => setHistory(s.items)), [])
  useEffect(() => window.overrun.onViewportState(setVp), [])
  // Ctrl+L / Alt+D (desde el main): enfoca y selecciona la barra de direcciones.
  useEffect(() => window.overrun.onFocusAddress(() => {
    const el = addrRef.current
    if (el) { el.focus(); el.select() }
  }), [])

  const navigateTo = (raw: string): void => {
    const url = raw.trim()
    if (!url) return
    window.overrun.navigate(url) // el main registra la visita en el historial persistido
    setShowHist(false)
  }
  const go = (): void => navigateTo(draft)

  // Autocompletado contra TODO el historial (url o título), no solo lo reciente.
  const q = draft.trim().toLowerCase()
  const suggestions = history
    .filter((e) => q === '' || e.url.toLowerCase().includes(q) || e.title.toLowerCase().includes(q))
    .slice(0, 8)

  // El dropdown se recorta por los bounds del chromeView; cuando está visible se
  // expande la vista del chrome a toda la ventana (transparente) para que flote.
  useEffect(() => {
    window.overrun.chromeExpand((showHist && suggestions.length > 0) || vpMenu)
  }, [showHist, suggestions.length, vpMenu])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* tab strip — zona de arrastre de la ventana (frameless); el padding
          derecho reserva el hueco de los controles nativos (overlay). */}
      <div style={{ height: 40, display: 'flex', alignItems: 'center', gap: 10, padding: '0 140px 0 14px', background: 'var(--void)', WebkitAppRegion: 'drag' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, WebkitAppRegion: 'no-drag' }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#101318', border: '1px solid #2a3038', boxShadow: '0 0 14px -4px oklch(0.82 0.15 195 / 0.5)' }}>
            <svg width="13" height="13" viewBox="0 0 14 14"><path d="M4.2 3.1 L11 7 L4.2 10.9 Z" fill="var(--cyan)" /></svg>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, letterSpacing: '0.18em' }}>OVERRUN</span>
        </div>

        {/* pestañas abiertas */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, flex: '0 1 auto', minWidth: 0, height: '100%', overflowX: 'auto', WebkitAppRegion: 'no-drag' }}>
          {tabs.tabs.map((t) => {
            const active = t.id === tabs.activeId
            return (
              <div key={t.id}
                onClick={() => window.overrun.tabActivate(t.id)}
                title={t.url || t.title}
                style={{ display: 'flex', alignItems: 'center', gap: 7, height: '100%', padding: '0 8px 0 11px', borderRadius: '8px 8px 0 0', cursor: 'pointer', maxWidth: 200, minWidth: 96, background: active ? 'var(--surface-2)' : 'transparent', border: '1px solid', borderColor: active ? 'var(--line-soft)' : 'transparent', borderBottom: 'none' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: t.loading ? 'var(--cyan)' : '#2563eb' }} />
                <span style={{ fontSize: 12, color: active ? '#e6e9ee' : '#9aa1ab', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.title || 'nueva pestaña'}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); window.overrun.tabClose(t.id) }}
                  title="Cerrar pestaña"
                  style={{ width: 17, height: 17, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5, border: 'none', background: 'transparent', color: '#8b929c', cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>
                  ×
                </button>
              </div>
            )
          })}
        </div>

        {/* nueva pestaña — fuera del scroll de tabs, siempre visible junto a la última */}
        <button
          onClick={() => window.overrun.tabNew()}
          title="Nueva pestaña"
          style={{ width: 26, height: 26, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, border: '1px solid var(--line-soft)', background: 'transparent', color: 'var(--dim)', cursor: 'pointer', fontSize: 16, lineHeight: 1, WebkitAppRegion: 'no-drag' }}>
          +
        </button>
      </div>

      {/* toolbar */}
      <div style={{ height: 52, display: 'flex', alignItems: 'center', gap: 12, padding: '0 14px', borderBottom: '1px solid var(--line-soft)', background: 'var(--surface-2)' }}>
        <div style={{ display: 'flex', gap: 2 }}>
          <NavBtn onClick={() => window.overrun.navAction('back')} disabled={!nav.canGoBack} d="M10 3 L5 8 L10 13" />
          <NavBtn onClick={() => window.overrun.navAction('forward')} disabled={!nav.canGoForward} d="M6 3 L11 8 L6 13" />
          <NavBtn onClick={() => window.overrun.navAction(nav.loading ? 'stop' : 'reload')} d="M13 3 v3 h-3 M13 6 A5.5 5.5 0 1 0 13.5 10" />
          <StarBtn saved={marks.currentSaved} onClick={() => window.overrun.bookmarkToggle()} />
          <BarToggle active={marks.barVisible} onClick={() => window.overrun.bookmarksBarToggle()} />
        </div>
        {/* barra de direcciones + dropdown de historial (custom, en paleta) */}
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            ref={addrRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && go()}
            onFocus={() => setShowHist(true)}
            onBlur={() => setShowHist(false)}
            spellCheck={false}
            placeholder="Ingresá una URL"
            style={{ width: '100%', height: 34, padding: '0 14px', borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--line)', color: '#cfd3d9', fontFamily: 'var(--font-mono)', fontSize: 12.5, outline: 'none', userSelect: 'text' }}
          />
          {showHist && suggestions.length > 0 && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 30, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 9, overflow: 'hidden', boxShadow: '0 18px 44px -14px rgba(0,0,0,0.7)' }}>
              <div style={{ padding: '7px 12px 3px', fontSize: 9, letterSpacing: '0.12em', color: 'var(--mute)', fontFamily: 'var(--font-mono)' }}>{q === '' ? 'RECIENTES' : 'HISTORIAL'}</div>
              {suggestions.map((e) => (
                <HistRow key={e.url} entry={e} onPick={() => navigateTo(e.url)} />
              ))}
            </div>
          )}
        </div>
        {/* selector de viewport / device mode */}
        <ViewportChip vp={vp} nav={nav} open={vpMenu} setOpen={setVpMenu} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 34, padding: '0 13px', borderRadius: 9, background: 'oklch(0.82 0.15 195 / 0.14)', border: '1px solid oklch(0.82 0.15 195 / 0.5)', color: 'var(--cyan-bright)', cursor: 'pointer' }}
          onClick={() => window.overrun.overlayControl('toggle')}>
          <svg width="15" height="15" viewBox="0 0 16 16"><path d="M1.5 8 h2.5 l1.5 -4 l2.5 8 l1.5 -4 h5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 600 }}>Observability</span>
        </div>
      </div>

      {/* barra de bookmarks (retráctil) */}
      {marks.barVisible && (
        <div style={{ height: 40, display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', borderBottom: '1px solid var(--line-soft)', background: 'var(--void)', overflowX: 'auto' }}>
          {marks.items.length === 0 ? (
            <span style={{ fontSize: 11.5, color: 'var(--dim)', fontStyle: 'italic' }}>
              Sin bookmarks — guardá la página actual con la estrella.
            </span>
          ) : (
            marks.items.map((b) => (
              <div key={b.id}
                onClick={() => window.overrun.bookmarkOpen(b.url)}
                title={b.url}
                style={{ display: 'flex', alignItems: 'center', gap: 6, height: 26, padding: '0 6px 0 10px', borderRadius: 7, flexShrink: 0, maxWidth: 190, cursor: 'pointer', background: 'var(--surface)', border: '1px solid var(--line)' }}>
                <span style={{ fontSize: 11.5, color: '#cfd3d9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {b.title || hostOf(b.url)}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); window.overrun.bookmarkRemove(b.id) }}
                  title="Quitar bookmark"
                  style={{ width: 16, height: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5, border: 'none', background: 'transparent', color: '#8b929c', cursor: 'pointer', fontSize: 12, lineHeight: 1 }}>
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function NavBtn({ onClick, disabled, d }: { onClick: () => void; disabled?: boolean; d: string }): JSX.Element {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, background: 'transparent', border: 'none', color: disabled ? '#4a5058' : 'var(--dim)', cursor: disabled ? 'default' : 'pointer' }}>
      <svg width="16" height="16" viewBox="0 0 16 16"><path d={d} stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
  )
}

// Estrella: llena (cyan) si la URL actual ya está guardada, contorno si no.
function StarBtn({ saved, onClick }: { saved: boolean; onClick: () => void }): JSX.Element {
  return (
    <button onClick={onClick} title={saved ? 'Quitar de bookmarks' : 'Guardar en bookmarks'}
      style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, background: 'transparent', border: 'none', color: saved ? 'var(--cyan)' : 'var(--dim)', cursor: 'pointer' }}>
      <svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 1.6 L9.9 5.5 L14.2 6.1 L11.1 9.1 L11.8 13.4 L8 11.4 L4.2 13.4 L4.9 9.1 L1.8 6.1 L6.1 5.5 Z" stroke="currentColor" strokeWidth="1.3" fill={saved ? 'currentColor' : 'none'} strokeLinejoin="round" /></svg>
    </button>
  )
}

// Alterna la barra de bookmarks (retráctil).
function BarToggle({ active, onClick }: { active: boolean; onClick: () => void }): JSX.Element {
  return (
    <button onClick={onClick} title={active ? 'Ocultar barra de bookmarks' : 'Mostrar barra de bookmarks'}
      style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, background: active ? 'var(--surface-2)' : 'transparent', border: 'none', color: active ? 'var(--cyan-bright)' : 'var(--dim)', cursor: 'pointer' }}>
      <svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 2.5 h8 v11 l-4 -2.6 l-4 2.6 Z" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round" /></svg>
    </button>
  )
}

// Fila del historial: título + url; hover en paleta; onMouseDown navega antes del blur.
function HistRow({ entry, onPick }: { entry: HistoryEntry; onPick: () => void }): JSX.Element {
  const [hover, setHover] = useState(false)
  return (
    <div
      onMouseDown={(e) => { e.preventDefault(); onPick() }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 12px', cursor: 'pointer', background: hover ? 'oklch(0.82 0.15 195 / 0.1)' : 'transparent' }}>
      <svg width="12" height="12" viewBox="0 0 16 16" style={{ flexShrink: 0, color: hover ? 'var(--cyan-bright)' : 'var(--mute)' }}>
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" fill="none" />
        <path d="M8 5 V8 L10 9.5" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: hover ? '#e6e9ee' : '#cfd3d9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.title}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.url}</div>
      </div>
    </div>
  )
}

// Selector de viewport / device mode. Muestra el device activo + dims; el menú
// lista "ajustar a ventana", presets, custom W×H y swap de orientación.
function ViewportChip({ vp, nav, open, setOpen }: { vp: ViewportState; nav: NavState; open: boolean; setOpen: (v: boolean) => void }): JSX.Element {
  const active = vp.presetId !== null
  const preset = DEVICE_PRESETS.find((d) => d.id === vp.presetId)
  const label = vp.presetId === null ? 'Ventana' : vp.presetId === 'custom' ? 'Custom' : preset?.label ?? 'Device'
  const dims = vp.presetId === null ? `${nav.viewport.width} × ${nav.viewport.height}` : `${vp.width} × ${vp.height}`
  const [cw, setCw] = useState('')
  const [chh, setChh] = useState('')

  // Al abrir, precarga los campos custom con las dims actuales.
  useEffect(() => {
    if (open) { setCw(String(vp.width || nav.viewport.width)); setChh(String(vp.height || nav.viewport.height)) }
  }, [open, vp.width, vp.height, nav.viewport.width, nav.viewport.height])

  const set = (presetId: string | null, extra: { width?: number; height?: number; landscape?: boolean } = {}): void => {
    window.overrun.viewportSet({ presetId, ...extra })
    setOpen(false)
  }
  const applyCustom = (): void => {
    const w = Number(cw), h = Number(chh)
    if (w > 0 && h > 0) set('custom', { width: w, height: h, landscape: vp.landscape })
  }

  return (
    <div style={{ position: 'relative' }}>
      <div onClick={() => setOpen(!open)} title="Viewport / device mode"
        style={{ display: 'flex', alignItems: 'center', gap: 8, height: 34, padding: '0 12px', borderRadius: 9, cursor: 'pointer', background: active ? 'oklch(0.82 0.15 195 / 0.14)' : 'var(--surface)', border: `1px solid ${active ? 'oklch(0.82 0.15 195 / 0.5)' : 'var(--line)'}`, color: active ? 'var(--cyan-bright)' : '#cfd3d9' }}>
        <svg width="14" height="14" viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none" /><path d="M6 13 H10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: active ? 'var(--cyan-bright)' : 'var(--dim)' }}>{dims}</span>
      </div>

      {open && (
        <>
          {/* backdrop: cierra al hacer clic fuera (el chrome está expandido sobre la página) */}
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 25 }} />
          <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 30, width: 250, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 18px 44px -14px rgba(0,0,0,0.7)', fontFamily: 'var(--font-mono)' }}>
            <VpRow label="Ajustar a ventana" sel={vp.presetId === null} hint="responsive" onClick={() => set(null)} />
            <div style={{ height: 1, background: 'var(--line-soft)' }} />
            {DEVICE_PRESETS.map((d) => (
              <VpRow key={d.id} label={d.label} sel={vp.presetId === d.id}
                hint={`${d.w}×${d.h}${d.mobile ? ' · touch' : ''}`}
                onClick={() => set(d.id, { landscape: vp.landscape })} />
            ))}
            <div style={{ height: 1, background: 'var(--line-soft)' }} />
            {/* custom W×H */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px' }}>
              <input value={cw} onChange={(e) => setCw(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && applyCustom()}
                placeholder="W" style={inp} />
              <span style={{ color: 'var(--mute)', fontSize: 11 }}>×</span>
              <input value={chh} onChange={(e) => setChh(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && applyCustom()}
                placeholder="H" style={inp} />
              <button onClick={applyCustom} style={{ height: 26, padding: '0 10px', borderRadius: 6, border: '1px solid oklch(0.82 0.15 195 / 0.5)', background: 'oklch(0.82 0.15 195 / 0.14)', color: 'var(--cyan-bright)', cursor: 'pointer', fontSize: 11 }}>Set</button>
            </div>
            {/* orientación */}
            <div onClick={() => active && set(vp.presetId, { width: vp.width, height: vp.height, landscape: !vp.landscape })}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderTop: '1px solid var(--line-soft)', cursor: active ? 'pointer' : 'default', opacity: active ? 1 : 0.4 }}>
              <svg width="14" height="14" viewBox="0 0 16 16" style={{ color: 'var(--dim)' }}><path d="M2 6 A6 6 0 0 1 13 5 M13 2 v3 h-3" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <span style={{ fontSize: 11.5, color: '#cfd3d9' }}>{vp.landscape ? 'Landscape' : 'Portrait'}</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 10, color: 'var(--mute)' }}>rotar</span>
            </div>
            {vp.clamped && (
              <div style={{ padding: '8px 12px', fontSize: 10, color: '#e0a458', background: 'oklch(0.72 0.13 60 / 0.1)', borderTop: '1px solid var(--line-soft)' }}>
                Recortado: agrandá la ventana para ver el ancho completo.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

const inp: CSSProperties = { width: 62, height: 26, padding: '0 8px', borderRadius: 6, background: 'var(--surface-2)', border: '1px solid var(--line)', color: '#cfd3d9', fontFamily: 'var(--font-mono)', fontSize: 11, outline: 'none', textAlign: 'center' }

function VpRow({ label, hint, sel, onClick }: { label: string; hint: string; sel: boolean; onClick: () => void }): JSX.Element {
  const [hover, setHover] = useState(false)
  return (
    <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', background: hover ? 'oklch(0.82 0.15 195 / 0.1)' : 'transparent' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: sel ? 'var(--cyan)' : 'transparent', border: sel ? 'none' : '1px solid var(--line)' }} />
      <span style={{ fontSize: 12, color: sel ? 'var(--cyan-bright)' : '#cfd3d9', flex: 1 }}>{label}</span>
      <span style={{ fontSize: 10, color: 'var(--mute)' }}>{hint}</span>
    </div>
  )
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}
