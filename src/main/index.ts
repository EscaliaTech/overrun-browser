import { app, BaseWindow, Menu } from 'electron'
import { electronApp, is } from '@electron-toolkit/utils'
import { createWindow, focusPage } from './window'

// El aviso de CSP inseguro de Electron es ruido en dev: aplica a cada página
// externa que se inspecciona (no controlamos su CSP) y no aparece empaquetado.
if (is.dev) process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

// Sin barra de menú nativa (File/Edit/View…). Overrun usa su propio chrome.
// Excepción macOS: ahí los atajos de edición (Cmd+C/V/X/A/Z) vienen de los roles
// del menú de aplicación, así que sin menú no se puede ni pegar una URL en la
// barra de direcciones. Se deja el mínimo: app + edición.
Menu.setApplicationMenu(process.platform === 'darwin'
  ? Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }])
  : null)

// ============================================================================
// Entry del proceso main de Overrun.
// Optimización nivel 1 (D-007): apagar features que no usamos vía switches.
// ============================================================================

// Apaga subsistemas innecesarios del motor (superficie + RAM). Ampliable.
app.commandLine.appendSwitch('disable-features', 'Translate,MediaRouter')
app.commandLine.appendSwitch('disable-background-networking')
app.commandLine.appendSwitch('disable-component-update')
app.commandLine.appendSwitch('no-default-browser-check')

const overrunToken = `Overrun/${app.getVersion()}`
if (!app.userAgentFallback.includes('Overrun/')) app.userAgentFallback = `${app.userAgentFallback} ${overrunToken}`

// El protocolo propio permite invocar URLs internas sin alterar la compatibilidad
// de navegación HTTP/S. El registro como browser predeterminado queda opcional.
if (process.defaultApp && process.argv.length >= 2) {
  app.setAsDefaultProtocolClient('overrun', process.execPath, [process.argv[1]])
} else {
  app.setAsDefaultProtocolClient('overrun')
}

if (!app.requestSingleInstanceLock()) app.quit()

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.overrun.app') // agrupado en taskbar (BRANDING)

  createWindow()

  app.on('open-url', (event, url) => {
    event.preventDefault()
    openProtocolUrl(url)
  })

  app.on('second-instance', (_event, argv) => {
    const url = argv.find((arg) => arg.startsWith('overrun://'))
    if (url) openProtocolUrl(url)
  })

  app.on('activate', () => {
    if (BaseWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

function openProtocolUrl(url: string): void {
  try {
    const target = new URL(url).searchParams.get('url')
    if (!target || !/^https?:/i.test(target)) return
    if (BaseWindow.getAllWindows().length === 0) createWindow()
    focusPage()?.loadURL(target).catch((err) => console.error('[protocol navigation]', err))
  } catch {
    // Ignore malformed external protocol invocations.
  }
}
