import type { Debugger } from 'electron'
import { bus } from './bus'
import type { SecurityAction, SecurityActionResult, SecurityRecord, SecurityRule, SecurityState } from '../../shared/events'
import {
  SECURITY_MAX_BODY_BYTES,
  isHttpUrl,
  matchRule,
  normalizeHeaders,
  redactBody,
  redactHeaders,
  ruleUrlPatterns
} from '../../shared/security'

export const SECURITY_TIMEOUT_MS = 15_000
export const SECURITY_MAX_PENDING = 50

/** CDP espera headers como lista de entradas y el body en base64. */
const headerEntries = (headers: Record<string, string>): { name: string; value: string }[] =>
  Object.entries(headers).map(([name, value]) => ({ name, value }))

interface PendingRequest {
  id: string
  method: string
  url: string
  resourceType?: string
  headers: Record<string, string>
  postData?: string
  timer: ReturnType<typeof setTimeout>
}

export class SecurityInterceptor {
  private enabled = false
  private pending = new Map<string, PendingRequest>()
  private rules: SecurityRule[] = []
  private message?: string

  constructor(private readonly dbg: Debugger) {}

  state(): SecurityState {
    return {
      enabled: this.enabled,
      pending: this.pending.size,
      timeoutMs: SECURITY_TIMEOUT_MS,
      maxPending: SECURITY_MAX_PENDING,
      rules: this.rules,
      message: this.message
    }
  }

  async setEnabled(enabled: boolean): Promise<SecurityActionResult> {
    try {
      if (enabled && !this.enabled) {
        await this.enableFetch()
        this.enabled = true
        this.message = 'Interceptación activa para esta pestaña.'
      } else if (!enabled && this.enabled) {
        await this.releaseAll()
        await this.dbg.sendCommand('Fetch.disable')
        this.enabled = false
        this.message = 'Interceptación desactivada; la cola fue liberada.'
      }
      return { ok: true, state: this.state() }
    } catch (error) {
      this.message = `CDP Fetch no está disponible: ${(error as Error).message}`
      return { ok: false, state: this.state(), error: this.message }
    }
  }

  /** Reemplaza las reglas; si está activo, reaplica el scope de `Fetch.enable`. */
  async setRules(rules: SecurityRule[]): Promise<SecurityActionResult> {
    this.rules = rules
    try {
      if (this.enabled) await this.enableFetch()
      this.message = rules.length
        ? `${rules.length} regla(s) activas; solo se intercepta el tráfico seleccionado.`
        : 'Sin reglas: se pausa todo el tráfico de la pestaña.'
      return { ok: true, state: this.state() }
    } catch (error) {
      this.message = `No se pudo aplicar el scope: ${(error as Error).message}`
      return { ok: false, state: this.state(), error: this.message }
    }
  }

  handleMessage(method: string, params: unknown): void {
    if (method === 'Fetch.requestPaused' && this.enabled) this.onPaused(params as any)
  }

  async act(action: SecurityAction): Promise<SecurityActionResult> {
    const request = this.pending.get(action.id)
    if (!request) return { ok: false, state: this.state(), error: 'La petición ya no está en espera.' }
    try {
      if (action.kind === 'continue') {
        await this.command('Fetch.continueRequest', { requestId: request.id })
        this.finish(request, 'continued', 'Continuada por el usuario.')
      } else if (action.kind === 'block') {
        await this.command('Fetch.failRequest', { requestId: request.id, errorReason: 'BlockedByClient' })
        this.finish(request, 'blocked', action.reason || 'Bloqueada por el usuario.')
      } else if (action.kind === 'fulfill') {
        const status = action.status ?? 200
        const headers = action.headers === undefined ? {} : normalizeHeaders(action.headers)
        const body = action.body ?? ''
        if (!Number.isInteger(status) || status < 100 || status > 599 || headers === null || body.length > SECURITY_MAX_BODY_BYTES) {
          return { ok: false, state: this.state(), error: 'La respuesta simulada no supera la validación local.' }
        }
        await this.command('Fetch.fulfillRequest', {
          requestId: request.id,
          responseCode: status,
          responseHeaders: headerEntries(headers),
          body: Buffer.from(body, 'utf8').toString('base64')
        })
        this.finish(request, 'fulfilled', `Respuesta simulada por el usuario (${status}).`)
      } else {
        const url = action.url ?? request.url
        const method = (action.method ?? request.method).toUpperCase()
        const headers = action.headers === undefined ? request.headers : normalizeHeaders(action.headers)
        const postData = action.postData === undefined ? request.postData : action.postData
        if (!isHttpUrl(url) || !/^[A-Z]{3,16}$/.test(method) || headers === null ||
          (postData !== undefined && (typeof postData !== 'string' || postData.length > SECURITY_MAX_BODY_BYTES))) {
          return { ok: false, state: this.state(), error: 'Los cambios no superan la validación local.' }
        }
        await this.command('Fetch.continueRequest', {
          requestId: request.id, url, method, headers: headerEntries(headers),
          ...(postData === undefined ? {} : { postData: Buffer.from(postData, 'utf8').toString('base64') })
        })
        this.finish({ ...request, url, method, headers, postData }, 'modified', 'Modificada por el usuario.')
      }
      this.message = undefined
      return { ok: true, state: this.state() }
    } catch (error) {
      this.message = `No se pudo aplicar la acción: ${(error as Error).message}`
      return { ok: false, state: this.state(), error: this.message }
    }
  }

  async dispose(): Promise<void> {
    if (this.enabled) {
      await this.releaseAll()
      try { await this.dbg.sendCommand('Fetch.disable') } catch { /* debugger already detached */ }
    }
    this.enabled = false
  }

  private async enableFetch(): Promise<void> {
    await this.dbg.sendCommand('Fetch.enable', {
      patterns: ruleUrlPatterns(this.rules).map((urlPattern) => ({ urlPattern, requestStage: 'Request' }))
    })
  }

  private onPaused(params: any): void {
    const source = params.request ?? {}
    const id = String(params.requestId ?? '')
    if (!id || !isHttpUrl(String(source.url ?? ''))) return
    const request: PendingRequest = {
      id, method: String(source.method ?? 'GET').toUpperCase(), url: String(source.url),
      resourceType: typeof params.resourceType === 'string' ? params.resourceType : undefined,
      headers: Object.fromEntries(Object.entries(source.headers ?? {}).map(([key, value]) => [key, String(value)])),
      postData: typeof source.postData === 'string' ? source.postData : undefined,
      timer: setTimeout(() => { void this.timeout(id) }, SECURITY_TIMEOUT_MS)
    }
    const rule = matchRule(this.rules, request)
    // Con reglas activas, lo que ninguna seleccionó sigue de largo: el scope de
    // `Fetch.enable` es más laxo que el matcher y no debe pausar de más.
    if (this.rules.length > 0 && !rule) {
      clearTimeout(request.timer)
      void this.command('Fetch.continueRequest', { requestId: id }).catch(() => { /* request ya cancelada */ })
      return
    }
    if (rule && rule.mode !== 'pause') {
      clearTimeout(request.timer)
      void this.applyRule(request, rule)
      return
    }
    this.pending.set(id, request)
    this.emit(request, 'intercepted', this.pending.size > SECURITY_MAX_PENDING
      ? 'Límite de cola alcanzado; se continuará automáticamente.' : 'Esperando acción del usuario.')
    if (this.pending.size > SECURITY_MAX_PENDING) void this.timeout(id)
  }

  /** Reglas automáticas: nunca dejan la petición colgada y siempre quedan en auditoría. */
  private async applyRule(request: Omit<PendingRequest, 'timer'>, rule: SecurityRule): Promise<void> {
    try {
      if (rule.mode === 'block') {
        await this.command('Fetch.failRequest', { requestId: request.id, errorReason: 'BlockedByClient' })
        this.emit(request, 'blocked', `Bloqueada por la regla ${rule.id}.`, rule.id)
        return
      }
      if (rule.mode === 'rewrite') {
        const url = rule.redirectTo ?? request.url
        const headers = { ...request.headers, ...(rule.setHeaders ?? {}) }
        await this.command('Fetch.continueRequest', { requestId: request.id, url, headers: headerEntries(headers) })
        this.emit({ ...request, url, headers }, 'modified', `Reescrita por la regla ${rule.id}.`, rule.id)
        return
      }
      await this.command('Fetch.continueRequest', { requestId: request.id })
      this.emit(request, 'continued', `Observada por la regla ${rule.id}.`, rule.id)
    } catch (error) {
      this.message = `La regla ${rule.id} falló: ${(error as Error).message}`
    }
  }

  private async timeout(id: string): Promise<void> {
    const request = this.pending.get(id)
    if (!request) return
    try { await this.command('Fetch.continueRequest', { requestId: id }) } catch { /* navigation may have canceled it */ }
    this.finish(request, 'timed-out', 'Tiempo de espera agotado; continuada automáticamente.')
  }

  private async releaseAll(): Promise<void> {
    const requests = [...this.pending.values()]
    await Promise.allSettled(requests.map((request) => this.command('Fetch.continueRequest', { requestId: request.id })))
    for (const request of requests) this.finish(request, 'disabled', 'Cola liberada al desactivar o cambiar de pestaña.')
  }

  private async command(method: string, params: object): Promise<void> {
    await this.dbg.sendCommand(method, params)
  }

  private finish(request: PendingRequest, phase: SecurityRecord['phase'], reason: string): void {
    clearTimeout(request.timer)
    if (!this.pending.delete(request.id)) return
    this.emit(request, phase, reason)
  }

  private emit(request: Omit<PendingRequest, 'timer'>, phase: SecurityRecord['phase'], reason: string, ruleId?: string): void {
    bus.emitEvent({
      domain: 'security',
      record: {
        id: request.id, phase, method: request.method, url: request.url, resourceType: request.resourceType,
        requestHeaders: redactHeaders(request.headers), postData: redactBody(request.postData), reason, ruleId, redacted: true
      }
    })
  }
}
