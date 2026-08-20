import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

// Tres superficies: main (Node), preload (bridge), renderer (React).
// El renderer tiene DOS entradas — chrome (barra/tabs) y overlay (panel) —
// que se montan cada una en su propio WebContentsView. Ver docs/ingenieria/INVESTIGACION-BASE.md §4.
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: { index: resolve('src/main/index.ts') } } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: { index: resolve('src/preload/index.ts') } } }
  },
  renderer: {
    root: 'src/renderer',
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          chrome: resolve('src/renderer/chrome/index.html'),
          overlay: resolve('src/renderer/overlay/index.html')
        }
      }
    }
  }
})
