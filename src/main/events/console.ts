import { bus } from './bus'
import type { ConsoleLevel, ConsoleRecord } from '../../shared/events'

// ============================================================================
// Normalizador del dominio Console: CDP → Overrun Events (REQ-021).
// Fuentes: Runtime.consoleAPICalled (console.*), Runtime.exceptionThrown
// (excepciones no capturadas), Log.entryAdded (logs del navegador: red, CSP…).
// ============================================================================

let nextId = 0

function emit(rec: Omit<ConsoleRecord, 'id'>): void {
  bus.emitEvent({ domain: 'console', record: { ...rec, id: ++nextId } })
}

/** RemoteObject de CDP → texto legible (preview simple). */
function renderArg(arg: any): string {
  if (!arg) return ''
  if (arg.type === 'string') return arg.value
  if (arg.type === 'number' || arg.type === 'boolean') return String(arg.value)
  if (arg.type === 'undefined') return 'undefined'
  if (arg.subtype === 'null') return 'null'
  return arg.description ?? arg.preview?.description ?? arg.type ?? ''
}

function levelFromApiType(type: string): ConsoleLevel {
  if (type === 'warning') return 'warn'
  if (type === 'error') return 'error'
  if (type === 'info' || type === 'debug') return type
  return 'log'
}

function levelFromLogLevel(level: string): ConsoleLevel {
  if (level === 'warning') return 'warn'
  if (level === 'error') return 'error'
  if (level === 'verbose' || level === 'debug') return 'debug'
  return 'info'
}

function frame(stack: any): { url?: string; line?: number } {
  const f = stack?.callFrames?.[0]
  return f ? { url: f.url, line: f.lineNumber } : {}
}

export function handleCdpConsole(method: string, params: any): void {
  switch (method) {
    case 'Runtime.consoleAPICalled': {
      const { url, line } = frame(params.stackTrace)
      emit({
        level: levelFromApiType(params.type),
        origin: 'console',
        text: (params.args ?? []).map(renderArg).join(' '),
        url,
        line
      })
      break
    }

    case 'Runtime.exceptionThrown': {
      const d = params.exceptionDetails ?? {}
      const text = d.exception?.description ?? d.text ?? 'Uncaught exception'
      emit({
        level: 'error',
        origin: 'exception',
        text,
        url: d.url ?? frame(d.stackTrace).url,
        line: d.lineNumber ?? frame(d.stackTrace).line
      })
      break
    }

    case 'Log.entryAdded': {
      const e = params.entry ?? {}
      emit({
        level: levelFromLogLevel(e.level),
        origin: 'browser',
        text: e.text ?? '',
        url: e.url,
        line: e.lineNumber
      })
      break
    }
  }
}

export function resetConsole(): void {
  // El id sigue creciendo (monotónico); no se reinicia para mantener orden global.
}
