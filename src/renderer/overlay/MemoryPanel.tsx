import { Throughput } from './Throughput'
import type { MemoryView } from './useMemory'

// Panel Memory (REQ-022): heap JS actual + serie temporal + contadores de DOM.
export function MemoryPanel({ mem }: { mem: MemoryView }): JSX.Element {
  const { latest, series } = mem

  if (!latest) {
    return <div style={{ padding: 20, fontSize: 11, color: 'var(--mute)', fontFamily: 'var(--font-mono)' }}>Sondeando memoria…</div>
  }

  const usedPct = latest.jsHeapTotal ? (latest.jsHeapUsed / latest.jsHeapTotal) * 100 : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1, fontFamily: 'var(--font-mono)', overflowY: 'auto' }}>
      {/* heap actual */}
      <div style={{ padding: '16px 14px 8px', borderBottom: '1px solid #22262e' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 26, color: 'var(--text)', fontWeight: 600 }}>{fmtMB(latest.jsHeapUsed)}</span>
          <span style={{ fontSize: 12, color: 'var(--dim)' }}>/ {fmtMB(latest.jsHeapTotal)} MB · JS heap</span>
        </div>
        <div style={{ marginTop: 10, height: 6, borderRadius: 3, background: '#20242c', overflow: 'hidden' }}>
          <div style={{ width: `${usedPct}%`, height: '100%', background: 'var(--cyan)', borderRadius: 3 }} />
        </div>
      </div>

      {/* serie temporal */}
      <div style={{ padding: '12px 14px 6px', borderBottom: '1px solid #22262e' }}>
        <div style={{ fontSize: 9.5, letterSpacing: '0.1em', color: 'var(--mute)', marginBottom: 6 }}>HEAP OVER TIME · ~1/s</div>
        <Throughput t={series.t} bytes={series.used} />
      </div>

      {/* DOM counters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <Tile label="NODES" value={fmt(latest.domNodes)} />
        <Tile label="DOCUMENTS" value={fmt(latest.documents)} />
        <Tile label="LISTENERS" value={fmt(latest.listeners)} last />
      </div>
    </div>
  )
}

function Tile({ label, value, last }: { label: string; value: string; last?: boolean }): JSX.Element {
  return (
    <div style={{ padding: '14px 14px', borderRight: last ? 'none' : '1px solid #22262e' }}>
      <div style={{ fontSize: 9, letterSpacing: '0.12em', color: 'var(--mute)' }}>{label}</div>
      <div style={{ fontSize: 18, marginTop: 4, color: 'var(--text)' }}>{value}</div>
    </div>
  )
}

function fmtMB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1)
}

function fmt(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}
