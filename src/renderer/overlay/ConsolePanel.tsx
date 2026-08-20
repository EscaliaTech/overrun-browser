import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { ConsoleLevel, ConsoleRecord } from '../../shared/events'
import type { ConsoleView } from './useConsole'

// Panel Console (REQ-021): lista virtualizada de logs/warns/errores/excepciones.
export function ConsolePanel({ con }: { con: ConsoleView }): JSX.Element {
  const { records, counts, clear } = con
  const parent = useRef<HTMLDivElement>(null)

  const rows = useVirtualizer({
    count: records.length,
    getScrollElement: () => parent.current,
    // Estimado inicial; la altura real la mide `measureElement` por fila, porque
    // el texto largo envuelve a varias líneas y una fila fija se solaparía.
    estimateSize: () => 30,
    overscan: 12
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1, fontFamily: 'var(--font-mono)' }}>
      {/* toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '9px 14px', borderBottom: '1px solid #22262e' }}>
        <Count label="errors" n={counts.error} color="oklch(0.7 0.19 25)" />
        <Count label="warns" n={counts.warn} color="oklch(0.82 0.15 85)" />
        <span style={{ flex: 1 }} />
        <button onClick={clear} title="limpiar" style={{ background: 'transparent', border: 'none', color: 'var(--mute)', cursor: 'pointer', display: 'flex' }}>
          <svg width="14" height="14" viewBox="0 0 16 16"><path d="M3 4 h10 M6 4 V3 h4 v1 M5 4 l0.6 9 a1 1 0 0 0 1 1 h2.8 a1 1 0 0 0 1 -1 L11 4" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>

      {/* líneas */}
      <div ref={parent} style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {records.length === 0 && (
          <div style={{ padding: 20, fontSize: 11, color: 'var(--mute)' }}>Sin salida de consola aún.</div>
        )}
        <div style={{ height: rows.getTotalSize(), position: 'relative' }}>
          {rows.getVirtualItems().map((vi) => (
            <Line key={vi.key} rec={records[vi.index]} top={vi.start} index={vi.index} measure={rows.measureElement} />
          ))}
        </div>
      </div>
    </div>
  )
}

function Line({ rec, top, index, measure }: { rec: ConsoleRecord; top: number; index: number; measure: (node: Element | null) => void }): JSX.Element {
  const c = levelColor(rec.level)
  return (
    <div ref={measure} data-index={index}
      style={{ position: 'absolute', top, left: 0, right: 0, minHeight: 30, display: 'flex', gap: 9, alignItems: 'flex-start', padding: '6px 12px', borderBottom: '1px solid #16181d', fontSize: 11, lineHeight: 1.4 }}>
      <Glyph level={rec.level} />
      <span style={{ flex: 1, color: c.text, wordBreak: 'break-word', userSelect: 'text' }}>{rec.text}</span>
      {rec.url && (
        <span style={{ color: 'var(--mute)', fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {shortUrl(rec.url)}{rec.line != null ? `:${rec.line}` : ''}
        </span>
      )}
    </div>
  )
}

function Glyph({ level }: { level: ConsoleLevel }): JSX.Element {
  const c = levelColor(level)
  if (level === 'error') {
    return <svg width="12" height="12" viewBox="0 0 16 16" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="8" cy="8" r="6" fill="none" stroke={c.mark} strokeWidth="1.3" /><path d="M6 6 L10 10 M10 6 L6 10" stroke={c.mark} strokeWidth="1.3" strokeLinecap="round" /></svg>
  }
  if (level === 'warn') {
    return <svg width="12" height="12" viewBox="0 0 16 16" style={{ flexShrink: 0, marginTop: 1 }}><path d="M8 2 L15 14 H1 Z" fill="none" stroke={c.mark} strokeWidth="1.3" strokeLinejoin="round" /><path d="M8 6.5 V9.5" stroke={c.mark} strokeWidth="1.3" strokeLinecap="round" /><circle cx="8" cy="11.6" r="0.7" fill={c.mark} /></svg>
  }
  return <span style={{ flexShrink: 0, marginTop: 1, color: c.mark, fontSize: 12 }}>›</span>
}

function Count({ label, n, color }: { label: string; n: number; color: string }): JSX.Element {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: n ? color : 'var(--mute)' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: n ? color : '#3a4048' }} />
      {n} {label}
    </span>
  )
}

function levelColor(level: ConsoleLevel): { text: string; mark: string } {
  switch (level) {
    case 'error':
      return { text: '#e6a0a0', mark: 'oklch(0.7 0.19 25)' }
    case 'warn':
      return { text: '#d6c48a', mark: 'oklch(0.82 0.15 85)' }
    case 'info':
      return { text: '#cfd3d9', mark: 'var(--cyan-bright)' }
    case 'debug':
      return { text: 'var(--dim)', mark: 'var(--mute)' }
    default:
      return { text: '#cfd3d9', mark: 'oklch(0.82 0.15 150)' }
  }
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.pathname.split('/').pop() || u.host
  } catch {
    return url
  }
}
