import { useEffect, useState } from 'react'
import type { NavState } from '../../shared/events'

// Barra + tabs de Overrun (chromeView). Frameless propio (BRANDING), no la UI de Chrome.
export function Chrome(): JSX.Element {
  const [nav, setNav] = useState<NavState>({ url: '', canGoBack: false, canGoForward: false, loading: false, viewport: { width: 0, height: 0 } })
  const [draft, setDraft] = useState('')

  useEffect(() => window.overrun.onNavState((s) => {
    setNav(s)
    setDraft(s.url)
  }), [])

  const go = (): void => window.overrun.navigate(draft)

  return (
    <div style={{ height: '100%', background: 'var(--void)', display: 'flex', flexDirection: 'column' }}>
      {/* tab strip */}
      <div style={{ height: 40, display: 'flex', alignItems: 'center', gap: 14, padding: '0 14px', borderBottom: '1px solid var(--line-soft)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#101318', border: '1px solid #2a3038', boxShadow: '0 0 14px -4px oklch(0.82 0.15 195 / 0.5)' }}>
            <svg width="13" height="13" viewBox="0 0 14 14"><path d="M4.2 3.1 L11 7 L4.2 10.9 Z" fill="var(--cyan)" /></svg>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, letterSpacing: '0.18em' }}>OVERRUN</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 30, padding: '0 12px', borderRadius: '8px 8px 0 0', background: 'var(--surface-2)', border: '1px solid var(--line-soft)', borderBottom: 'none' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: nav.loading ? 'var(--cyan)' : '#2563eb' }} />
          <span style={{ fontSize: 12, color: '#cfd3d9', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {hostOf(nav.url) || 'nueva pestaña'}
          </span>
        </div>
      </div>

      {/* toolbar */}
      <div style={{ height: 52, display: 'flex', alignItems: 'center', gap: 12, padding: '0 14px', borderBottom: '1px solid var(--line-soft)', background: '#0c0e12' }}>
        <div style={{ display: 'flex', gap: 2 }}>
          <NavBtn onClick={() => window.overrun.navAction('back')} disabled={!nav.canGoBack} d="M10 3 L5 8 L10 13" />
          <NavBtn onClick={() => window.overrun.navAction('forward')} disabled={!nav.canGoForward} d="M6 3 L11 8 L6 13" />
          <NavBtn onClick={() => window.overrun.navAction(nav.loading ? 'stop' : 'reload')} d="M13 3 v3 h-3 M13 6 A5.5 5.5 0 1 0 13.5 10" />
        </div>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && go()}
          spellCheck={false}
          placeholder="Ingresá una URL"
          style={{ flex: 1, height: 34, padding: '0 14px', borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--line)', color: '#cfd3d9', fontFamily: 'var(--font-mono)', fontSize: 12.5, outline: 'none', userSelect: 'text' }}
        />
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

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}
