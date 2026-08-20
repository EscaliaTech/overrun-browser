import { useState, type CSSProperties, type ReactNode } from 'react'
import type { NetworkRecord, NetworkTiming } from '../../shared/events'

// Detalle de un request (REQ-020): General, Timing waterfall, Headers, Payload, Response.
export function RequestDetail({ rec, onBack }: { rec: NetworkRecord; onBack: () => void }): JSX.Element {
  const [body, setBody] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const loadBody = async (): Promise<void> => {
    setLoading(true)
    const res = await window.overrun.getResponseBody(rec.requestId)
    setBody(res.base64 ? '— binario (base64) —' : res.body)
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1, fontFamily: 'var(--font-mono)' }}>
      {/* back */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid #22262e' }}>
        <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: '#9aa1ab', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          <svg width="12" height="12" viewBox="0 0 16 16"><path d="M10 3 L5 8 L10 13" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          requests
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <Section title="GENERAL">
          <KV k="URL" v={rec.url} wrap />
          <KV k="Method" v={rec.method} />
          <KV k="Status" v={rec.failed ? `failed · ${rec.errorText ?? ''}` : `${rec.status ?? '—'} ${rec.statusText ?? ''}`} />
          <KV k="Type" v={rec.type ?? '—'} />
          <KV k="Protocol" v={rec.protocol ?? '—'} />
          <KV k="Remote" v={rec.remoteAddress ?? '—'} />
          <KV k="Initiator" v={rec.initiator ? `${rec.initiator}${rec.initiatorUrl ? ` · ${short(rec.initiatorUrl)}${rec.initiatorLine != null ? `:${rec.initiatorLine}` : ''}` : ''}` : '—'} />
          <KV k="Size" v={rec.fromCache ? 'from cache' : rec.size != null ? `${rec.size} B` : '—'} />
          <KV k="Duration" v={rec.duration != null ? `${Math.round(rec.duration)} ms` : '—'} />
        </Section>

        {rec.timing && <Section title="TIMING"><Waterfall timing={rec.timing} /></Section>}

        <Section title="REQUEST HEADERS"><Headers h={rec.requestHeaders} /></Section>

        {rec.postData && (
          <Section title="PAYLOAD">
            <pre style={preStyle}>{rec.postData}</pre>
          </Section>
        )}

        <Section title="RESPONSE HEADERS"><Headers h={rec.responseHeaders} /></Section>

        <Section title="RESPONSE">
          {body == null ? (
            <button onClick={loadBody} disabled={loading} style={loadBtn}>
              {loading ? 'cargando…' : 'cargar body'}
            </button>
          ) : (
            <pre style={preStyle}>{body.slice(0, 20000)}</pre>
          )}
        </Section>
      </div>
    </div>
  )
}

function Waterfall({ timing }: { timing: NetworkTiming }): JSX.Element {
  const parts: { label: string; ms: number; color: string }[] = [
    { label: 'DNS', ms: timing.dns ?? 0, color: 'oklch(0.82 0.15 85)' },
    { label: 'Connect', ms: timing.connect ?? 0, color: 'oklch(0.82 0.15 150)' },
    { label: 'TLS', ms: timing.tls ?? 0, color: 'oklch(0.7 0.19 25)' },
    { label: 'TTFB', ms: timing.ttfb ?? 0, color: 'var(--cyan)' }
  ].filter((p) => p.ms > 0)
  const total = parts.reduce((a, p) => a + p.ms, 0) || 1
  return (
    <div style={{ padding: '2px 0' }}>
      <div style={{ display: 'flex', height: 10, borderRadius: 3, overflow: 'hidden', background: '#20242c' }}>
        {parts.map((p) => (
          <div key={p.label} style={{ width: `${(p.ms / total) * 100}%`, background: p.color }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
        {parts.map((p) => (
          <span key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--dim)' }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, background: p.color }} />
            {p.label} {Math.round(p.ms)}ms
          </span>
        ))}
      </div>
    </div>
  )
}

function Headers({ h }: { h?: Record<string, string> }): JSX.Element {
  const entries = h ? Object.entries(h) : []
  if (!entries.length) return <span style={{ fontSize: 10.5, color: 'var(--mute)' }}>—</span>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {entries.map(([k, v]) => (
        <div key={k} style={{ fontSize: 10.5, lineHeight: 1.4, wordBreak: 'break-all' }}>
          <span style={{ color: 'var(--cyan-bright)' }}>{k}</span>
          <span style={{ color: 'var(--dim)' }}>: {v}</span>
        </div>
      ))}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <div style={{ padding: '12px 14px', borderBottom: '1px solid #1c2027' }}>
      <div style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--mute)', marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  )
}

function KV({ k, v, wrap }: { k: string; v: string; wrap?: boolean }): JSX.Element {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 8, padding: '3px 0', fontSize: 11 }}>
      <span style={{ color: 'var(--mute)' }}>{k}</span>
      <span style={{ color: '#cfd3d9', wordBreak: wrap ? 'break-all' : 'normal', overflow: wrap ? 'visible' : 'hidden', textOverflow: 'ellipsis', whiteSpace: wrap ? 'normal' : 'nowrap' }}>{v}</span>
    </div>
  )
}

const preStyle: CSSProperties = {
  margin: 0,
  fontSize: 10.5,
  lineHeight: 1.5,
  color: '#cfd3d9',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
  maxHeight: 220,
  overflow: 'auto',
  userSelect: 'text'
}

const loadBtn: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  color: 'var(--cyan-bright)',
  borderRadius: 7,
  padding: '6px 12px',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  cursor: 'pointer'
}

function short(url: string): string {
  try {
    const u = new URL(url)
    return u.pathname.split('/').pop() || u.host
  } catch {
    return url
  }
}
