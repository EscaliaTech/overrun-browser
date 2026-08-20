import { Throughput } from './Throughput'
import type { PerformanceView } from './usePerformance'

// Panel CPU / Performance (REQ-023): gauge de utilización + JS/render/FPS + timeline.
// Señales atribuibles a la página; NO es CPU% de proceso del SO.
export function PerformancePanel({ perf }: { perf: PerformanceView }): JSX.Element {
  const { latest, series } = perf

  if (!latest) {
    return <div style={{ padding: 20, fontSize: 11, color: 'var(--mute)', fontFamily: 'var(--font-mono)' }}>Sondeando performance…</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1, fontFamily: 'var(--font-mono)', overflowY: 'auto' }}>
      {/* gauge + breakdown */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 14px', borderBottom: '1px solid #22262e' }}>
        <Gauge pct={latest.cpuPct} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9 }}>
          <Metric label="JS" value={`${Math.round(latest.jsMs)} ms`} />
          <Metric label="RENDER" value={`${Math.round(latest.renderMs)} ms`} />
          <Metric label="FPS" value={String(Math.round(latest.fps))} />
        </div>
      </div>

      {/* timeline cpu% */}
      <div style={{ padding: '12px 14px 6px', borderBottom: '1px solid #22262e' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 9.5, letterSpacing: '0.1em', color: 'var(--mute)' }}>MAIN-THREAD %</span>
          <span style={{ fontSize: 11, color: 'var(--cyan-bright)' }}>{Math.round(latest.cpuPct)}%</span>
        </div>
        <Throughput t={series.t} bytes={series.cpu} />
      </div>

      {/* nota honesta de alcance */}
      <div style={{ padding: '10px 14px', fontSize: 9.5, color: 'var(--mute)', lineHeight: 1.5 }}>
        Utilización del hilo principal de la página (task time / wall time). No incluye CPU del
        proceso a nivel SO ni long tasks (Tracing) — se suman después.
      </div>
    </div>
  )
}

function Gauge({ pct }: { pct: number }): JSX.Element {
  const r = 42
  const circ = 2 * Math.PI * r
  const off = circ * (1 - Math.min(100, pct) / 100)
  const color = pct >= 80 ? 'oklch(0.7 0.19 25)' : pct >= 50 ? 'oklch(0.82 0.15 85)' : 'var(--cyan)'
  return (
    <svg width="96" height="96" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#20242c" strokeWidth="9" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off} transform="rotate(-90 50 50)" />
      <text x="50" y="49" textAnchor="middle" fill="var(--text)" fontSize="21" fontFamily="JetBrains Mono, monospace" fontWeight="600">{Math.round(pct)}%</text>
      <text x="50" y="63" textAnchor="middle" fill="var(--mute)" fontSize="8.5" fontFamily="JetBrains Mono, monospace" letterSpacing="1">CPU</text>
    </svg>
  )
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <div style={{ fontSize: 9, color: 'var(--mute)', letterSpacing: '0.1em' }}>{label}</div>
      <div style={{ fontSize: 14, color: '#cfd3d9', marginTop: 1 }}>{value}</div>
    </div>
  )
}
