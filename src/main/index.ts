import { app, BaseWindow, Menu } from 'electron'
import { electronApp, is } from '@electron-toolkit/utils'
import { createWindow } from './window'

// El aviso de CSP inseguro de Electron es ruido en dev: aplica a cada página
// externa que se inspecciona (no controlamos su CSP) y no aparece empaquetado.
if (is.dev) process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

// Sin barra de menú nativa (File/Edit/View…). Overrun usa su propio chrome.
Menu.setApplicationMenu(null)

// ============================================================================
// Entry del proceso main de Overrun.
// Optimización nivel 1 (D-007): apagar features que no usamos vía switches.
// ============================================================================

// Apaga subsistemas innecesarios del motor (superficie + RAM). Ampliable.
app.commandLine.appendSwitch('disable-features', 'Translate,MediaRouter')

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.overrun.app') // agrupado en taskbar (BRANDING)

  createWindow()

  app.on('activate', () => {
    if (BaseWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
