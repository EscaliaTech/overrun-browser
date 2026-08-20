import { EventEmitter } from 'node:events'
import type { OverrunEvent } from '../../shared/events'

// ============================================================================
// Overrun Events bus (D-013 / REQ-066)
//
// Punto central por el que pasan TODOS los eventos normalizados. Los dominios
// (network, console, …) emiten acá; los consumidores (overlay vía IPC, y en v3
// el servidor MCP) se suscriben acá. Nadie habla CDP directo con la UI.
// ============================================================================

class OverrunBus extends EventEmitter {
  private seq = 0

  /** Sella el envelope (seq + ts) y emite. Los normalizadores llaman esto. */
  emitEvent(partial: Omit<OverrunEvent, 'seq' | 'ts'>): OverrunEvent {
    const evt = { ...partial, seq: ++this.seq, ts: Date.now() } as OverrunEvent
    this.emit('event', evt)
    return evt
  }

  onEvent(fn: (evt: OverrunEvent) => void): () => void {
    this.on('event', fn)
    return () => this.off('event', fn)
  }
}

/** Instancia única por proceso main. */
export const bus = new OverrunBus()
