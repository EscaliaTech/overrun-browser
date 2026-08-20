import { useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { NetworkRecord } from '../../shared/events'
import type { NetworkView } from './useNetwork'
import { Throughput } from './Throughput'
import { RequestDetail } from './RequestDetail'

// Panel Network (D-015 / REQ-020): stats + throughput (Canvas) + tabla virtualizada + detalle.
export function NetworkPanel({ net }: { net: NetworkView }): JSX.Element {
  const { records, stats, throughput, clear } = net
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const parent = useRef<HTMLDivElement>(null)

  const rows = useVirtualizer({
    count: records.length,
    getScrollElement: () => parent.current,
    estimateSize: () => 26,
    overscan: 12
  })

  const selected = selectedId ? records.find((r) => r.requestId === selectedId) : undefined
  if (selected) return <RequestDetail rec={selected} onBack={() => setSelectedId(null)} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      {/* stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr) auto', alignItems: 'center', borderBottom: '1px solid #22262e', fontFamily: 'var(--font-mono)' }}>
        <Stat label="REQUESTS" value={String(stats.requests)} />
        <Stat label="TRANSFER" value={fmtBytes(stats.transfer)} accent />
        <button onClick={() => { clear(); setSelectedId(null) }} title="limpiar"
          style={{ background: 'transparent', border: 'none', color: 'var(--mute)', cursor: 'pointer', padding: '0 14px', display: 'flex', alignItems: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 16 16"><path d="M3 4 h10 M6 4 V3 h4 v1 M5 4 l0.6 9 a1 1 0 0 0 1 1 h2.8 a1 1 0 0 0 1 -1 L11 4" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>

      {/* throughput */}
      <div style={{ padding: '10px 14px 4px', fontFamily: 'var(--font-mono)' }}>
        <div style={{ fontSize: 9.5, letterSpacing: '0.1em', color: 'var(--mute)', marginBottom: 6 }}>THROUGHPUT · bytes/s</div>
        <Throughput t={throughput.t} bytes={throughput.bytes} />
      </div>

      {/* header tabla */}
      <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 40px 56px 46px', padding: '6px 12px', fontSize: 9, letterSpacing: '0.06em', color: 'var(--mute)', fontFamily: 'var(--font-mono)', borderBottom: '1px solid #22262e' }}>
        <span>MTD</span>
        <span>NAME</span>
        <span style={{ textAlign: 'right' }}>ST</span>
        <span style={{ textAlign: 'right' }}>SIZE</span>
        <span style={{ textAlign: 'right' }}>TIME</span>
      </div>

      {/* filas virtualizadas */}
      <div ref={parent} style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <div style={{ height: rows.getTotalSize(), position: 'relative' }}>
          {rows.getVirtualItems().map((vi) => (
            <Row key={vi.key} rec={records[vi.index]} top={vi.start} even={vi.index % 2 === 0} onClick={() => setSelectedId(records[vi.index].requestId)} />
          ))}
        </div>
      </div>
    </div>
  )
}

function Row({ rec, top, even, onClick }: { rec: NetworkRecord; top: number; even: boolean; onClick: () => void }): JSX.Element {
  return (
    <div onClick={onClick}
      style={{ position: 'absolute', top, left: 0, right: 0, height: 26, display: 'grid', gridTemplateColumns: '40px 1fr 40px 56px 46px', alignItems: 'center', padding: '0 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#cfd3d9', background: even ? 'transparent' : '#14171c', cursor: 'pointer' }}>
      <span style={{ color: methodColor(rec.method), fontSize: 9.5 }}>{rec.method}</span>
      <span style={{ color: '#9aa1ab', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameOf(rec.url)}</span>
      <span style={{ textAlign: 'right', color: statusColor(rec) }}>{rec.failed ? 'ERR' : rec.status ?? '—'}</span>
      <span style={{ textAlign: 'right', color: 'var(--dim)' }}>{rec.fromCache ? 'cache' : rec.size ? fmtBytes(rec.size) : '—'}</span>
      <span style={{ textAlign: 'right', color: 'var(--dim)' }}>{rec.duration != null ? `${Math.round(rec.duration)}ms` : '…'}</span>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }): JSX.Element {
  return (
    <div style={{ padding: '12px 14px', borderRight: '1px solid #22262e' }}>
      <div style={{ fontSize: 9, letterSpacing: '0.12em', color: 'var(--mute)' }}>{label}</div>
      <div style={{ fontSize: 17, marginTop: 3, color: accent ? 'var(--cyan-bright)' : 'var(--text)' }}>{value}</div>
    </div>
  )
}

function nameOf(url: string): string {
  try {
    const u = new URL(url)
    return (u.pathname === '/' ? u.host : u.pathname.split('/').pop() || u.pathname) || url
  } catch {
    return url
  }
}

function methodColor(m: string): string {
  if (m === 'POST' || m === 'PUT' || m === 'PATCH') return 'oklch(0.82 0.15 150)'
  if (m === 'DELETE') return 'oklch(0.7 0.19 25)'
  return 'var(--mute)'
}

function statusColor(rec: NetworkRecord): string {
  if (rec.failed || (rec.status && rec.status >= 400)) return 'oklch(0.7 0.19 25)'
  if (rec.status && rec.status >= 300) return 'var(--mute)'
  if (rec.status && rec.status >= 200) return 'oklch(0.82 0.15 150)'
  return 'var(--dim)'
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}
