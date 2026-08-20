import { useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { NetworkRecord } from '../../shared/events'
import type { NetworkView } from './useNetwork'
import { Throughput } from './Throughput'
import { RequestDetail } from './RequestDetail'

// Panel Network (D-015 / REQ-020): stats + throughput (Canvas) + tabla virtualizada + detalle.
const TYPES = ['all', 'fetch', 'js', 'css', 'img', 'doc', 'other'] as const
type TypeFilter = (typeof TYPES)[number]
const TYPE_LABEL: Record<TypeFilter, string> = { all: 'Todo', fetch: 'Fetch/XHR', js: 'JS', css: 'CSS', img: 'Img', doc: 'Doc', other: 'Otro' }

export function NetworkPanel({ net }: { net: NetworkView }): JSX.Element {
  const { records, stats, throughput, clear } = net
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [type, setType] = useState<TypeFilter>('all')
  const parent = useRef<HTMLDivElement>(null)

  const q = search.toLowerCase()
  const filtered = records.filter(
    (r) => matchType(r.type, type) && (q === '' || r.url.toLowerCase().includes(q))
  )

  const rows = useVirtualizer({
    count: filtered.length,
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

      {/* filtros: búsqueda + tipo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid #22262e' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 7, height: 28, padding: '0 10px', borderRadius: 7, background: 'var(--surface)', border: '1px solid var(--line)' }}>
          <svg width="12" height="12" viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.5" stroke="var(--mute)" strokeWidth="1.3" fill="none" /><path d="M10.5 10.5 L14 14" stroke="var(--mute)" strokeWidth="1.3" strokeLinecap="round" /></svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)} spellCheck={false} placeholder="filtrar por URL"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#cfd3d9', fontFamily: 'var(--font-mono)', fontSize: 11, userSelect: 'text' }} />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'transparent', border: 'none', color: 'var(--mute)', cursor: 'pointer', display: 'flex', padding: 0 }}>
              <svg width="11" height="11" viewBox="0 0 12 12"><path d="M3 3 L9 9 M9 3 L3 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
            </button>
          )}
        </div>
        <select value={type} onChange={(e) => setType(e.target.value as TypeFilter)}
          style={{ height: 28, borderRadius: 7, background: 'var(--surface)', border: '1px solid var(--line)', color: '#cfd3d9', fontFamily: 'var(--font-mono)', fontSize: 11, padding: '0 6px', outline: 'none', cursor: 'pointer' }}>
          {TYPES.map((t) => <option key={t} value={t} style={{ background: '#14161b' }}>{TYPE_LABEL[t]}</option>)}
        </select>
      </div>

      {/* header tabla */}
      <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 40px 56px 46px', padding: '6px 12px', fontSize: 9, letterSpacing: '0.06em', color: 'var(--mute)', fontFamily: 'var(--font-mono)', borderBottom: '1px solid #22262e' }}>
        <span>MTD</span>
        <span>NAME</span>
        <span style={{ textAlign: 'right' }}>ST</span>
        <span style={{ textAlign: 'right' }}>SIZE</span>
        <span style={{ textAlign: 'right' }}>TIME</span>
      </div>

      {/* filas virtualizadas (sobre el conjunto filtrado) */}
      <div ref={parent} style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {filtered.length === 0 && (
          <div style={{ padding: 20, fontSize: 11, color: 'var(--mute)', fontFamily: 'var(--font-mono)' }}>
            {records.length === 0 ? 'Sin requests aún.' : 'Ningún request coincide con el filtro.'}
          </div>
        )}
        <div style={{ height: rows.getTotalSize(), position: 'relative' }}>
          {rows.getVirtualItems().map((vi) => (
            <Row key={vi.key} rec={filtered[vi.index]} top={vi.start} even={vi.index % 2 === 0} onClick={() => setSelectedId(filtered[vi.index].requestId)} />
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

const TYPE_GROUPS: Record<Exclude<TypeFilter, 'all' | 'other'>, string[]> = {
  fetch: ['XHR', 'Fetch', 'EventSource'],
  js: ['Script'],
  css: ['Stylesheet'],
  img: ['Image'],
  doc: ['Document']
}

function matchType(recType: string | undefined, filter: TypeFilter): boolean {
  if (filter === 'all') return true
  const t = recType ?? 'Other'
  if (filter === 'other') return !Object.values(TYPE_GROUPS).some((g) => g.includes(t))
  return TYPE_GROUPS[filter].includes(t)
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
