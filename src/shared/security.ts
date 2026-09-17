// ============================================================================
// Security (v2 / REQ-040) — lógica pura compartida main ↔ renderer.
//
// Acá viven redacción y reglas: no importa Electron ni CDP, así que el renderer
// valida con el mismo código que aplica el main y las pruebas corren sin Electron.
// ============================================================================

import type { SecurityRule, SecurityRuleMode } from './events'

export const SECURITY_MAX_BODY_BYTES = 256 * 1024
export const SECURITY_RULE_MODES: SecurityRuleMode[] = ['pause', 'observe', 'rewrite', 'block']

const SECRET_NAME = /authorization|cookie|token|secret|password|api[-_]?key|session/i
const SECRET_VALUE = /((?:token|secret|password|api[_-]?key)=)[^&\s"']+/gi

/** Redacta headers antes de que entren a un evento, auditoría, UI o exportación. */
export function redactHeaders(headers: Record<string, unknown> | undefined): Record<string, string> {
  return Object.fromEntries(Object.entries(headers ?? {}).map(([name, value]) => [
    name, SECRET_NAME.test(name) ? '[redacted]' : String(value)
  ]))
}

export function redactBody(body: string | undefined): string | undefined {
  if (!body) return body
  if (body.length > SECURITY_MAX_BODY_BYTES) return `[redacted: body excede ${SECURITY_MAX_BODY_BYTES} bytes]`
  try {
    const redactValue = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(redactValue)
      if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, child]) => [
          key, SECRET_NAME.test(key) ? '[redacted]' : redactValue(child)
        ]))
      }
      return value
    }
    return JSON.stringify(redactValue(JSON.parse(body)))
  } catch {
    return body.replace(SECRET_VALUE, '$1[redacted]')
  }
}

/** Headers con nombre/valor válidos para CDP; `null` si algo no supera la validación. */
export function normalizeHeaders(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const entries = Object.entries(value)
  if (entries.length > 100) return null
  const result: Record<string, string> = {}
  for (const [name, content] of entries) {
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,128}$/.test(name) || typeof content !== 'string' || content.length > 8192) return null
    result[name] = content
  }
  return result
}

export function isHttpUrl(value: string): boolean {
  try {
    return /^https?:$/.test(new URL(value).protocol)
  } catch {
    return false
  }
}

/** Valida una regla venida del renderer; `null` si no es usable. */
export function parseRule(value: unknown): SecurityRule | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const mode = raw.mode as SecurityRuleMode
  if (!SECURITY_RULE_MODES.includes(mode)) return null
  const host = typeof raw.host === 'string' && raw.host.trim() ? raw.host.trim().toLowerCase() : '*'
  const path = typeof raw.path === 'string' ? raw.path.trim() : ''
  const method = typeof raw.method === 'string' && raw.method.trim() ? raw.method.trim().toUpperCase() : '*'
  if (host.length > 253 || path.length > 512 || !/^(\*|[A-Z]{3,16})$/.test(method)) return null
  if (/[\s"'<>]/.test(host) || /[\s"'<>]/.test(path)) return null
  const rule: SecurityRule = {
    id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 64) : `r${Date.now().toString(36)}`,
    host, path, method, mode
  }
  if (mode === 'rewrite') {
    const headers = raw.setHeaders === undefined ? {} : normalizeHeaders(raw.setHeaders)
    if (headers === null) return null
    if (Object.keys(headers).length) rule.setHeaders = headers
    if (typeof raw.redirectTo === 'string' && raw.redirectTo) {
      if (!isHttpUrl(raw.redirectTo)) return null
      rule.redirectTo = raw.redirectTo
    }
  }
  return rule
}

export function parseRules(value: unknown): SecurityRule[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 50).map(parseRule).filter((rule): rule is SecurityRule => rule !== null)
}

/** `*.example.com` matchea subdominios y el dominio raíz; `*` matchea todo. */
function hostMatches(pattern: string, host: string): boolean {
  if (pattern === '*') return true
  if (pattern.startsWith('*.')) {
    const base = pattern.slice(2)
    return host === base || host.endsWith(`.${base}`)
  }
  return host === pattern
}

/** Primera regla que aplica a la petición, o `null` (⇒ pausa manual). */
export function matchRule(rules: SecurityRule[], request: { url: string; method: string }): SecurityRule | null {
  let url: URL
  try {
    url = new URL(request.url)
  } catch {
    return null
  }
  const method = request.method.toUpperCase()
  return rules.find((rule) =>
    (rule.method === '*' || rule.method === method) &&
    hostMatches(rule.host, url.hostname.toLowerCase()) &&
    (rule.path === '' || `${url.pathname}${url.search}`.startsWith(rule.path))
  ) ?? null
}

/**
 * Patrones para `Fetch.enable`: sin reglas se intercepta todo (pausa manual);
 * con reglas solo se pausa el tráfico que alguna regla seleccionó (spec 2.1.1).
 */
export function ruleUrlPatterns(rules: SecurityRule[]): string[] {
  if (rules.length === 0) return ['*']
  const patterns = rules.map((rule) =>
    rule.host === '*' ? '*' : `*://${rule.host}${rule.path.startsWith('/') ? rule.path : `/${rule.path}`}*`
  )
  return patterns.includes('*') ? ['*'] : [...new Set(patterns)]
}
