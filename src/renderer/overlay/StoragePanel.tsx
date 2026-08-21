import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { CookieInfo, StorageDetail, StorageKV } from '../../shared/events'
import type { StorageView } from './useStorage'

// Panel Storage (REQ-024): uso/quota + desglose por tipo + entradas reales
// (cookies, localStorage, sessionStorage) del origen activo.
const LABELS: Record<string, string> = {
  cookies: 'Cookies',
  localstorage: 'localStorage',
  indexeddb: 'IndexedDB',
  cache_storage: 'Cache Storage',
  service_workers: 'Service Workers',
  database: 'Database',
  websql: 'WebSQL',
  filesystem: 'File System',
  shared_storage: 'Shared Storage',
  interest_groups: 'Interest Groups',
  other: 'Otro'
}

export function StoragePanel({ st }: { st: StorageView }): JSX.Element {
  const { latest } = st
  const [detail, setDetail] = useState<StorageDetail | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true)
    setDetail(await window.overrun.getStorageDetail())
    setLoading(false)
  }, [])

  // Carga el detalle al montar y cuando cambia el origen.
  useEffect(() => {
    void refresh()
  }, [refresh, latest?.origin])

  if (!latest) {
    return <div style={{ padding: 20, fontSize: 11, color: 'var(--mute)', fontFamily: 'var(--font-mono)' }}>Sondeando storage…</div>
  }

  const usedPct = latest.quota ? (latest.usage / latest.quota) * 100 : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1, fontFamily: 'var(--font-mono)', overflowY: 'auto' }}>
      {/* total usage / quota */}
      <div style={{ padding: '16px 14px 12px', borderBottom: '1px solid #22262e' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 24, color: 'var(--text)', fontWeight: 600 }}>{fmt(latest.usage)}</span>
          <span style={{ fontSize: 12, color: 'var(--dim)' }}>/ {fmt(latest.quota)} usados</span>
          <span style={{ flex: 1 }} />
          <button onClick={refresh} title="refrescar" style={{ background: 'transparent', border: 'none', color: loading ? 'var(--cyan)' : 'var(--mute)', cursor: 'pointer', display: 'flex' }}>
            <svg width="14" height="14" viewBox="0 0 16 16"><path d="M13 3 v3 h-3 M13 6 A5.5 5.5 0 1 0 13.5 10" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
        <div style={{ marginTop: 10, height: 6, borderRadius: 3, background: '#20242c', overflow: 'hidden' }}>
          <div style={{ width: `${Math.max(0.5, Math.min(100, usedPct))}%`, height: '100%', background: 'var(--cyan)', borderRadius: 3 }} />
        </div>
        <div style={{ marginTop: 8, fontSize: 10, color: 'var(--mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{latest.origin}</div>
      </div>

      {/* desglose por tipo */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, borderBottom: '1px solid #22262e' }}>
        <div style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--mute)' }}>POR TIPO</div>
        {latest.breakdown.length === 0 ? (
          <span style={{ fontSize: 11, color: 'var(--mute)' }}>Sin datos almacenados en este origen.</span>
        ) : (
          latest.breakdown.map((b) => {
            const pct = latest.usage ? (b.bytes / latest.usage) * 100 : 0
            return (
              <div key={b.type}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: '#cfd3d9' }}>{LABELS[b.type] ?? b.type}</span>
                  <span style={{ fontSize: 10, color: 'var(--dim)' }}>{fmt(b.bytes)}</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: '#20242c', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(2, pct)}%`, height: '100%', borderRadius: 2, background: 'var(--cyan)' }} />
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* entradas reales */}
      <Section title="COOKIES" count={detail?.cookies.length ?? 0}>
        {(detail?.cookies ?? []).map((c) => <CookieRow key={`${c.name}@${c.domain}${c.path}`} c={c} />)}
      </Section>
      <Section title="LOCALSTORAGE" count={detail?.local.length ?? 0}>
        {(detail?.local ?? []).map((kv) => <KVRow key={kv.key} kv={kv} />)}
      </Section>
      <Section title="SESSIONSTORAGE" count={detail?.session.length ?? 0}>
        {(detail?.session ?? []).map((kv) => <KVRow key={kv.key} kv={kv} />)}
      </Section>
    </div>
  )
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }): JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom: '1px solid #1c2027' }}>
      <div onClick={() => setOpen((o) => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', cursor: 'pointer' }}>
        <svg width="10" height="10" viewBox="0 0 12 12" style={{ color: 'var(--mute)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.1s' }}><path d="M4 3 L8 6 L4 9" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <span style={{ fontSize: 9.5, letterSpacing: '0.14em', color: 'var(--mute)' }}>{title}</span>
        <span style={{ fontSize: 10, color: count ? 'var(--cyan-bright)' : 'var(--mute)' }}>{count}</span>
      </div>
      {open && (
        <div style={{ padding: '0 14px 10px' }}>
          {count === 0 ? <span style={{ fontSize: 10.5, color: 'var(--mute)' }}>—</span> : children}
        </div>
      )}
    </div>
  )
}

function CookieRow({ c }: { c: CookieInfo }): JSX.Element {
  return (
    <div style={{ padding: '5px 0', borderBottom: '1px solid #16181d' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color: '#cfd3d9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
        {c.secure && <Flag>S</Flag>}
        {c.httpOnly && <Flag>H</Flag>}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 9, color: 'var(--mute)' }}>{c.domain}</span>
      </div>
      <div style={{ fontSize: 10, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', userSelect: 'text' }}>{c.value}</div>
    </div>
  )
}

function KVRow({ kv }: { kv: StorageKV }): JSX.Element {
  return (
    <div style={{ padding: '5px 0', borderBottom: '1px solid #16181d' }}>
      <div style={{ fontSize: 11, color: 'var(--cyan-bright)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{kv.key}</div>
      <div style={{ fontSize: 10, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', userSelect: 'text' }}>{kv.value}</div>
    </div>
  )
}

function Flag({ children }: { children: ReactNode }): JSX.Element {
  return <span style={{ fontSize: 8, color: 'var(--mute)', border: '1px solid var(--line)', borderRadius: 3, padding: '0 3px', flexShrink: 0 }}>{children}</span>
}

function fmt(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}
