import { useState, type CSSProperties, type ReactNode } from 'react'
import type { SecurityRecord, SecurityRule, SecurityRuleMode } from '../../shared/events'
import { SECURITY_RULE_MODES, parseRule } from '../../shared/security'
import type { SecurityView } from './useSecurity'

// ============================================================================
// Panel Security (v2 fases 2.0/2.1 — REQ-040)
//
// Permiso explícito, cola de peticiones pausadas con inspector editable,
// reglas locales por host/path/método y timeline de auditoría. La UI nunca
// ejecuta nada de la página: solo muestra texto ya redactado por el main.
// ============================================================================

const PHASE_COLOR: Record<SecurityRecord['phase'], string> = {
  intercepted: 'var(--cyan-bright)',
  continued: 'var(--green)',
  modified: 'oklch(0.8 0.16 90)',
  fulfilled: 'oklch(0.8 0.16 90)',
  blocked: 'oklch(0.7 0.19 25)',
  'timed-out': 'var(--mute)',
  disabled: 'var(--mute)'
}

const MODE_HINT: Record<SecurityRuleMode, string> = {
  pause: 'pausa y espera decisión',
  observe: 'registra y continúa',
  rewrite: 'aplica headers/destino y continúa',
  block: 'falla la petición'
}

export function SecurityPanel({ sec }: { sec: SecurityView }): JSX.Element {
  const { state, queue, audit } = sec
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState('')

  const current = queue.find((r) => r.id === selected) ?? queue[0] ?? null

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>): Promise<void> => {
    const result = await fn()
    setError(result.ok ? '' : result.error ?? 'La acción falló.')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1, fontFamily: 'var(--font-mono)', overflowY: 'auto' }}>
      {/* permiso de sesión — apagado por defecto, banner persistente mientras está activo */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #22262e', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => void run(() => window.overrun.securitySetEnabled(!state.enabled))}
            style={{ ...btn, borderColor: state.enabled ? 'oklch(0.7 0.19 25)' : 'var(--line)', color: state.enabled ? 'oklch(0.75 0.19 25)' : 'var(--dim)' }}>
            {state.enabled ? 'Desactivar interceptación' : 'Activar interceptación'}
          </button>
          <span style={{ fontSize: 10, color: 'var(--dim)' }}>
            cola {state.pending}/{state.maxPending} · timeout {Math.round(state.timeoutMs / 1000)}s
          </span>
        </div>
        {state.enabled && (
          <div style={{ padding: '6px 9px', borderRadius: 5, border: '1px solid oklch(0.55 0.15 25)', background: 'oklch(0.3 0.08 25 / 0.35)', fontSize: 10.5, color: 'oklch(0.85 0.1 25)' }}>
            Modo interceptación activo — solo sobre sistemas autorizados. El tráfico de esta pestaña se pausa.
          </div>
        )}
        {(error || state.message) && (
          <div style={{ fontSize: 10, color: error ? 'oklch(0.75 0.19 25)' : 'var(--mute)' }}>{error || state.message}</div>
        )}
      </div>

      {/* cola + inspector */}
      <Section title="EN ESPERA" count={queue.length} open>
        {queue.length === 0 ? (
          <span style={{ fontSize: 10.5, color: 'var(--mute)' }}>
            {state.enabled ? 'Sin peticiones pausadas.' : 'Interceptación apagada: nada se pausa.'}
          </span>
        ) : (
          <>
            <div style={{ maxHeight: 130, overflowY: 'auto', marginBottom: 8 }}>
              {queue.map((r) => (
                <div key={r.id} onClick={() => setSelected(r.id)}
                  style={{ display: 'flex', gap: 7, padding: '5px 6px', cursor: 'pointer', borderRadius: 4, background: current?.id === r.id ? '#1b2027' : 'transparent' }}>
                  <span style={{ fontSize: 10, color: 'var(--cyan-bright)', width: 46, flexShrink: 0 }}>{r.method}</span>
                  <span style={{ fontSize: 10.5, color: '#cfd3d9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.url}</span>
                </div>
              ))}
            </div>
            {current && <Inspector key={current.id} record={current} run={run} />}
          </>
        )}
      </Section>

      <Rules rules={state.rules} run={run} />

      <Section title="AUDITORÍA" count={audit.length}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
          <button onClick={sec.clear} style={btn}>Limpiar</button>
        </div>
        <div style={{ maxHeight: 220, overflowY: 'auto' }}>
          {audit.slice().reverse().map((r, i) => (
            <div key={`${r.id}-${r.ts}-${i}`} style={{ padding: '4px 0', borderBottom: '1px solid #16181d' }}>
              <div style={{ display: 'flex', gap: 7, alignItems: 'baseline' }}>
                <span style={{ fontSize: 9, color: 'var(--mute)' }}>{new Date(r.ts).toLocaleTimeString()}</span>
                <span style={{ fontSize: 9.5, color: PHASE_COLOR[r.phase] }}>{r.phase}</span>
                <span style={{ fontSize: 10, color: '#cfd3d9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.method} {r.url}</span>
              </div>
              <div style={{ fontSize: 9.5, color: 'var(--mute)' }}>{r.reason}{r.ruleId ? ` · regla ${r.ruleId}` : ''}</div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

type Run = (fn: () => Promise<{ ok: boolean; error?: string }>) => Promise<void>

/** Inspector editable de la petición pausada: continuar, modificar, responder o bloquear. */
function Inspector({ record, run }: { record: SecurityRecord; run: Run }): JSX.Element {
  const [url, setUrl] = useState(record.url)
  const [method, setMethod] = useState(record.method)
  const [headers, setHeaders] = useState(stringifyHeaders(record.requestHeaders))
  const [body, setBody] = useState(record.postData ?? '')
  const [status, setStatus] = useState('200')
  const [mock, setMock] = useState('')
  const [confirm, setConfirm] = useState<'block' | 'fulfill' | null>(null)
  const changed = url !== record.url || method !== record.method || body !== (record.postData ?? '') ||
    headers !== stringifyHeaders(record.requestHeaders)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 6, borderTop: '1px solid #22262e' }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={method} onChange={(e) => setMethod(e.target.value)} style={{ ...input, width: 66 }} />
        <input value={url} onChange={(e) => setUrl(e.target.value)} style={{ ...input, flex: 1 }} />
      </div>
      <Label>HEADERS (uno por línea: nombre: valor · los secretos llegan redactados)</Label>
      <textarea value={headers} onChange={(e) => setHeaders(e.target.value)} rows={4} style={{ ...input, resize: 'vertical' }} />
      <Label>BODY</Label>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} style={{ ...input, resize: 'vertical' }} />

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => void run(() => window.overrun.securityAction({ kind: 'continue', id: record.id }))} style={btn}>
          Continuar
        </button>
        <button disabled={!changed}
          onClick={() => void run(() => window.overrun.securityAction({
            kind: 'modify', id: record.id, url, method, headers: parseHeaders(headers), postData: body || undefined
          }))}
          style={{ ...btn, opacity: changed ? 1 : 0.4, color: changed ? 'oklch(0.85 0.16 90)' : 'var(--dim)' }}>
          Enviar modificada
        </button>
        {confirm === 'block' ? (
          <Confirm text="¿Bloquear?" onCancel={() => setConfirm(null)}
            onOk={() => { setConfirm(null); void run(() => window.overrun.securityAction({ kind: 'block', id: record.id })) }} />
        ) : (
          <button onClick={() => setConfirm('block')} style={{ ...btn, color: 'oklch(0.75 0.19 25)' }}>Bloquear</button>
        )}
      </div>

      <Label>RESPUESTA SIMULADA</Label>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...input, width: 56 }} />
        <input value={mock} onChange={(e) => setMock(e.target.value)} placeholder="cuerpo" style={{ ...input, flex: 1 }} />
        {confirm === 'fulfill' ? (
          <Confirm text="¿Responder sin llegar al servidor?" onCancel={() => setConfirm(null)}
            onOk={() => {
              setConfirm(null)
              void run(() => window.overrun.securityAction({ kind: 'fulfill', id: record.id, status: Number(status), body: mock }))
            }} />
        ) : (
          <button onClick={() => setConfirm('fulfill')} style={{ ...btn, color: 'oklch(0.85 0.16 90)' }}>Responder</button>
        )}
      </div>
    </div>
  )
}

/** Reglas locales por host/path/método (fase 2.1.6). Se envían completas al main. */
function Rules({ rules, run }: { rules: SecurityRule[]; run: Run }): JSX.Element {
  const [host, setHost] = useState('')
  const [path, setPath] = useState('')
  const [method, setMethod] = useState('*')
  const [mode, setMode] = useState<SecurityRuleMode>('observe')
  const [invalid, setInvalid] = useState('')

  const save = (next: SecurityRule[]): void => void run(() => window.overrun.securitySetRules(next))

  const add = (): void => {
    const rule = parseRule({ host: host || '*', path, method, mode })
    if (!rule) {
      setInvalid('Regla inválida: revisá host, path o método.')
      return
    }
    setInvalid('')
    setHost('')
    setPath('')
    save([...rules, rule])
  }

  return (
    <Section title="REGLAS" count={rules.length}>
      <div style={{ fontSize: 9.5, color: 'var(--mute)', marginBottom: 8 }}>
        Con reglas, `Fetch` solo intercepta el tráfico seleccionado. Sin reglas se pausa todo.
      </div>
      {rules.map((rule) => (
        <div key={rule.id} style={{ display: 'flex', gap: 7, alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #16181d' }}>
          <span style={{ fontSize: 10, color: 'var(--cyan-bright)', width: 46, flexShrink: 0 }}>{rule.method}</span>
          <span style={{ fontSize: 10.5, color: '#cfd3d9', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {rule.host}{rule.path}
          </span>
          <span style={{ fontSize: 9.5, color: 'var(--dim)' }} title={MODE_HINT[rule.mode]}>{rule.mode}</span>
          <button onClick={() => save(rules.filter((r) => r.id !== rule.id))} style={{ ...btn, padding: '1px 5px' }}>×</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
        <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="host o *.dominio" style={{ ...input, flex: 1, minWidth: 110 }} />
        <input value={path} onChange={(e) => setPath(e.target.value)} placeholder="/prefijo" style={{ ...input, width: 84 }} />
        <input value={method} onChange={(e) => setMethod(e.target.value)} style={{ ...input, width: 52 }} />
        <select value={mode} onChange={(e) => setMode(e.target.value as SecurityRuleMode)} style={{ ...input, width: 84 }}>
          {SECURITY_RULE_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <button onClick={add} style={btn}>Agregar</button>
      </div>
      <div style={{ fontSize: 9.5, color: invalid ? 'oklch(0.75 0.19 25)' : 'var(--mute)', marginTop: 5 }}>
        {invalid || MODE_HINT[mode]}
      </div>
    </Section>
  )
}

function Confirm({ text, onOk, onCancel }: { text: string; onOk: () => void; onCancel: () => void }): JSX.Element {
  return (
    <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
      <span style={{ fontSize: 10, color: 'oklch(0.85 0.1 25)' }}>{text}</span>
      <button onClick={onOk} style={{ ...btn, color: 'oklch(0.75 0.19 25)' }}>Sí</button>
      <button onClick={onCancel} style={btn}>No</button>
    </span>
  )
}

function Section({ title, count, open: initial, children }: { title: string; count: number; open?: boolean; children: ReactNode }): JSX.Element {
  const [open, setOpen] = useState(initial ?? false)
  return (
    <div style={{ borderBottom: '1px solid #1c2027' }}>
      <div onClick={() => setOpen((o) => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', cursor: 'pointer' }}>
        <svg width="10" height="10" viewBox="0 0 12 12" style={{ color: 'var(--mute)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.1s' }}><path d="M4 3 L8 6 L4 9" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <span style={{ fontSize: 9.5, letterSpacing: '0.14em', color: 'var(--mute)' }}>{title}</span>
        <span style={{ fontSize: 10, color: count ? 'var(--cyan-bright)' : 'var(--mute)' }}>{count}</span>
      </div>
      {open && <div style={{ padding: '0 14px 12px' }}>{children}</div>}
    </div>
  )
}

function Label({ children }: { children: ReactNode }): JSX.Element {
  return <span style={{ fontSize: 9, letterSpacing: '0.12em', color: 'var(--mute)' }}>{children}</span>
}

function stringifyHeaders(headers: Record<string, string>): string {
  return Object.entries(headers).map(([name, value]) => `${name}: ${value}`).join('\n')
}

function parseHeaders(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const idx = line.indexOf(':')
    if (idx <= 0) continue
    out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
  }
  return out
}

const input: CSSProperties = {
  background: '#14171c',
  border: '1px solid var(--line)',
  borderRadius: 4,
  color: '#cfd3d9',
  fontFamily: 'var(--font-mono)',
  fontSize: 10.5,
  padding: '4px 6px'
}

const btn: CSSProperties = {
  border: '1px solid var(--line)',
  borderRadius: 4,
  background: 'transparent',
  color: 'var(--dim)',
  cursor: 'pointer',
  padding: '3px 7px',
  fontFamily: 'var(--font-mono)',
  fontSize: 10
}
