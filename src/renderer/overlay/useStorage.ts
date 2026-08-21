import { useEffect, useState } from 'react'
import type { OverrunEvent, StorageRecord } from '../../shared/events'

export interface StorageView {
  latest: StorageRecord | null
}

/** Último snapshot de storage (REQ-024). Llega ~1 cada 2s. */
export function useStorage(): StorageView {
  const [view, setView] = useState<StorageView>({ latest: null })
  useEffect(
    () =>
      window.overrun.onEvent((evt: OverrunEvent) => {
        if (evt.domain === 'storage') setView({ latest: evt.record })
      }),
    []
  )
  return view
}
