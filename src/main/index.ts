import { app, BaseWindow, Menu } from 'electron'
import { electronApp } from '@electron-toolkit/utils'
import { createWindow } from './window'

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
