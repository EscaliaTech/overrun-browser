import { useEffect, useState } from 'react'
import type { NavState, TabsState, BookmarksState } from '../../shared/events'

// Barra + tabs de Overrun (chromeView). Frameless propio (BRANDING), no la UI de Chrome.
export function Chrome(): JSX.Element {
  const [nav, setNav] = useState<NavState>({ url: '', canGoBack: false, canGoForward: false, loading: false, viewport: { width: 0, height: 0 } })
  const [draft, setDraft] = useState('')
  const [tabs, setTabs] = useState<TabsState>({ tabs: [], activeId: '' })
  const [marks, setMarks] = useState<BookmarksState>({ items: [], barVisible: false, currentSaved: false })
  // Histórico de las últimas 5 búsquedas/URLs (sesión; el chrome no se recarga).
  const [history, setHistory] = useState<string[]>([])

  useEffect(() => window.overrun.onNavState((s) => {
    setNav(s)
    setDraft(s.url)
  }), [])
  useEffect(() => window.overrun.onTabsState(setTabs), [])
  useEffect(() => window.overrun.onBookmarksState(setMarks), [])

  const go = (): void => {
    const url = draft.trim()
    if (!url) return
    window.overrun.navigate(url)
    setHistory((h) => [url, ...h.filter((u) => u !== url)].slice(0, 5))
  }

  return (
    <div style={{ height: '100%', background: 'var(--void)', display: 'flex', flexDirection: 'column' }}>
      {/* tab strip — zona de arrastre de la ventana (frameless); el padding
          derecho reserva el hueco de los controles nativos (overlay). */}
      <div style={{ height: 40, display: 'flex', alignItems: 'center', gap: 10, padding: '0 140px 0 14px', borderBottom: '1px solid var(--line-soft)', WebkitAppRegion: 'drag' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, WebkitAppRegion: 'no-drag' }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#101318', border: '1px solid #2a3038', boxShadow: '0 0 14px -4px oklch(0.82 0.15 195 / 0.5)' }}>
            <svg width="13" height="13" viewBox="0 0 14 14"><path d="M4.2 3.1 L11 7 L4.2 10.9 Z" fill="var(--cyan)" /></svg>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, letterSpacing: '0.18em' }}>OVERRUN</span>
        </div>

        {/* pestañas abiertas */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, flex: 1, minWidth: 0, height: '100%', overflowX: 'auto', WebkitAppRegion: 'no-drag' }}>
          {tabs.tabs.map((t) => {
            const active = t.id === tabs.activeId
            return (
              <div key={t.id}
                onClick={() => window.overrun.tabActivate(t.id)}
                title={t.url || t.title}
                style={{ display: 'flex', alignItems: 'center', gap: 7, height: 30, padding: '0 8px 0 11px', borderRadius: '8px 8px 0 0', cursor: 'pointer', maxWidth: 200, minWidth: 96, background: active ? 'var(--surface-2)' : 'transparent', border: '1px solid', borderColor: active ? 'var(--line-soft)' : 'transparent', borderBottom: 'none' }}>
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
      <div style={{ height: 52, display: 'flex', alignItems: 'center', gap: 12, padding: '0 14px', borderBottom: '1px solid var(--line-soft)', background: '#0c0e12' }}>
        <div style={{ display: 'flex', gap: 2 }}>
          <NavBtn onClick={() => window.overrun.navAction('back')} disabled={!nav.canGoBack} d="M10 3 L5 8 L10 13" />
          <NavBtn onClick={() => window.overrun.navAction('forward')} disabled={!nav.canGoForward} d="M6 3 L11 8 L6 13" />
          <NavBtn onClick={() => window.overrun.navAction(nav.loading ? 'stop' : 'reload')} d="M13 3 v3 h-3 M13 6 A5.5 5.5 0 1 0 13.5 10" />
          <StarBtn saved={marks.currentSaved} onClick={() => window.overrun.bookmarkToggle()} />
          <BarToggle active={marks.barVisible} onClick={() => window.overrun.bookmarksBarToggle()} />
        </div>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && go()}
          spellCheck={false}
          placeholder="Ingresá una URL"
          list="url-history"
          style={{ flex: 1, height: 34, padding: '0 14px', borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--line)', color: '#cfd3d9', fontFamily: 'var(--font-mono)', fontSize: 12.5, outline: 'none', userSelect: 'text' }}
        />
        <datalist id="url-history">
          {history.map((u) => <option key={u} value={u} />)}
        </datalist>
        {/* resolución actual del viewport de la página */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 34, padding: '0 12px', borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--line)' }}>
          <svg width="14" height="14" viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="8" rx="1" stroke="var(--dim)" strokeWidth="1.3" fill="none" /><path d="M6 13 H10" stroke="var(--dim)" strokeWidth="1.3" strokeLinecap="round" /></svg>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#cfd3d9' }}>{nav.viewport.width} × {nav.viewport.height}</span>
        </div>
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

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}
