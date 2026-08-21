import type { StorageView } from './useStorage'

// Panel Storage (REQ-024): uso/quota del origen + desglose por tipo de almacenamiento.
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
        </div>
        <div style={{ marginTop: 10, height: 6, borderRadius: 3, background: '#20242c', overflow: 'hidden' }}>
          <div style={{ width: `${Math.max(0.5, Math.min(100, usedPct))}%`, height: '100%', background: 'var(--cyan)', borderRadius: 3 }} />
        </div>
        <div style={{ marginTop: 8, fontSize: 10, color: 'var(--mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{latest.origin}</div>
      </div>

      {/* desglose por tipo */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--mute)' }}>POR TIPO</div>
        {latest.breakdown.length === 0 ? (
          <span style={{ fontSize: 11, color: 'var(--mute)' }}>Sin datos almacenados en este origen.</span>
        ) : (
          latest.breakdown.map((b) => {
            const pct = latest.usage ? (b.bytes / latest.usage) * 100 : 0
            return (
              <div key={b.type}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
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
    </div>
  )
}

function fmt(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}
