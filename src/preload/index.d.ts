import type { OverrunApi } from './index'

declare global {
  interface Window {
    overrun: OverrunApi
  }
}

export {}
