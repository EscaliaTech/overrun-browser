import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { NetworkPanel } from './NetworkPanel'
import { ConsolePanel } from './ConsolePanel'
import { MemoryPanel } from './MemoryPanel'
import { PerformancePanel } from './PerformancePanel'
import { useNetwork } from './useNetwork'
import { useConsole } from './useConsole'
import { useMemory } from './useMemory'
import { usePerformance } from './usePerformance'

type Tab = 'Network' | 'Console' | 'Memory' | 'CPU' | 'Storage'
const TABS: Tab[] = ['Network', 'Console', 'Memory', 'CPU', 'Storage']
const ENABLED: Tab[] = ['Network', 'Console', 'Memory', 'CPU'] // v1 en progreso

// Gesto de arrastre genérico: captura el puntero y manda deltas de pantalla al
// callback (mover o redimensionar). `moved` distingue drag de click (para el pill).
function useDrag(onDelta: (dx: number, dy: number) => void): {
  handlers: {
    onPointerDown: (e: ReactPointerEvent) => void
    onPointerMove: (e: ReactPointerEvent) => void
    onPointerUp: (e: ReactPointerEvent) => void
  }
  moved: () => boolean
} {
  const drag = useRef<{ id: number; x: number; y: number } | null>(null)
  const moved = useRef(false)
  return {
    moved: () => moved.current,
    handlers: {
      onPointerDown: (e) => {
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        drag.current = { id: e.pointerId, x: e.screenX, y: e.screenY }
        moved.current = false
      },
      onPointerMove: (e) => {
        const d = drag.current
        if (!d) return
        const dx = e.screenX - d.x
        const dy = e.screenY - d.y
        if (dx || dy) {
          if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved.current = true
          onDelta(dx, dy)
          d.x = e.screenX
          d.y = e.screenY
        }
      },
      onPointerUp: (e) => {
        const el = e.currentTarget as HTMLElement
        if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
        drag.current = null
      }
    }
  }
}

// overlayView: panel flotante colapsable. El estado colapsado lo manda el main
// (fuente de verdad) para mantener sincronizado el tamaño de la vista (D-017).
export function Overlay(): JSX.Element {
  const [collapsed, setCollapsed] = useState(false)
  const [tab, setTab] = useState<Tab>('Network')
  const drag = useDrag((dx, dy) => window.overrun.overlayMove(dx, dy))
  const resize = useDrag((dx, dy) => window.overrun.overlayResize(dx, dy))
  // Hooks montados SIEMPRE (aun colapsado) → los dominios se recolectan sin
  // importar el tab activo ni el estado del overlay.
  const net = useNetwork()
  const con = useConsole()
  const mem = useMemory()
  const perf = usePerformance()

  useEffect(() => window.overrun.onOverlayState(setCollapsed), [])

  if (collapsed) return <Pill drag={drag} onExpand={() => !drag.moved() && window.overrun.overlayControl('expand')} />

  return (
    <div style={panelStyle}>
      {/* handle de resize — esquina superior-izquierda */}
      <div {...resize.handlers} title="redimensionar"
        style={{ position: 'absolute', top: 0, left: 0, width: 16, height: 16, cursor: 'nwse-resize', zIndex: 10, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', padding: 3 }}>
        <svg width="9" height="9" viewBox="0 0 9 9" style={{ color: 'var(--mute)' }}><path d="M1 8 L1 1 L8 1 M1 4 L4 1 M1 7 L7 1" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" /></svg>
      </div>

      {/* header — zona de arrastre */}
      <div style={{ height: 42, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', borderBottom: '1px solid #22262e' }}>
        <div {...drag.handlers} style={{ display: 'flex', alignItems: 'center', gap: 9, flex: 1, height: '100%', cursor: 'move' }}>
          <span style={dot('var(--cyan)')} />
          <span style={{ fontSize: 10.5, letterSpacing: '0.18em', color: '#b8bec7', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>OBSERVABILITY</span>
        </div>
        <button onClick={() => window.overrun.overlayControl('collapse')} style={iconBtn}>
          <svg width="13" height="13" viewBox="0 0 16 16"><path d="M4 6 L8 10 L12 6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>

      {/* tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '8px 10px 0', borderBottom: '1px solid #22262e', fontFamily: 'var(--font-mono)' }}>
        {TABS.map((t) => {
          const active = t === tab
          const enabled = ENABLED.includes(t)
          const badge = t === 'Console' && con.counts.error > 0 ? con.counts.error : 0
          return (
            <div key={t}
              onClick={() => enabled && setTab(t)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 11px', fontSize: 11, cursor: enabled ? 'pointer' : 'default', color: active ? 'var(--cyan-bright)' : enabled ? '#9aa1ab' : '#4a5058', borderBottom: active ? '2px solid var(--cyan)' : '2px solid transparent', marginBottom: -1 }}>
              {t}
              {badge > 0 && <span style={{ fontSize: 9, color: 'oklch(0.7 0.19 25)' }}>{badge}</span>}
            </div>
          )
        })}
      </div>

      {tab === 'Network' ? <NetworkPanel net={net} /> : tab === 'Console' ? <ConsolePanel con={con} /> : tab === 'Memory' ? <MemoryPanel mem={mem} /> : tab === 'CPU' ? <PerformancePanel perf={perf} /> : <Placeholder tab={tab} />}

      {/* footer */}
      <div style={{ height: 34, display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', borderTop: '1px solid #22262e', fontFamily: 'var(--font-mono)' }}>
        <span style={dot('var(--green)')} />
        <span style={{ fontSize: 10, color: 'var(--dim)' }}>CDP 1.3 · attached</span>
      </div>
    </div>
  )
}

function Pill({ onExpand, drag }: { onExpand: () => void; drag: ReturnType<typeof useDrag> }): JSX.Element {
  return (
    <div onClick={onExpand} {...drag.handlers} style={{ ...panelStyle, height: 44, flexDirection: 'row', alignItems: 'center', gap: 10, padding: '0 14px', cursor: 'move' }}>
      <span style={dot('var(--cyan)')} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: '#cfd3d9' }}>Observability</span>
      <span style={{ flex: 1 }} />
      <svg width="13" height="13" viewBox="0 0 16 16" style={{ color: '#9aa1ab' }}><path d="M4 10 L8 6 L12 10" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </div>
  )
}

function Placeholder({ tab }: { tab: Tab }): JSX.Element {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mute)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
      {tab} — v1
    </div>
  )
}

const panelStyle: CSSProperties = {
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  background: 'rgba(12,14,18,0.9)',
  backdropFilter: 'blur(20px)',
  border: '1px solid #2b303a',
  borderRadius: 16,
  boxShadow: '0 30px 70px -20px rgba(0,0,0,0.75), 0 0 50px -14px oklch(0.82 0.15 195 / 0.3)',
  overflow: 'hidden'
}

const iconBtn: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--mute)',
  cursor: 'pointer',
  display: 'flex'
}

function dot(color: string): CSSProperties {
  return { width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: `0 0 9px ${color}` }
}
