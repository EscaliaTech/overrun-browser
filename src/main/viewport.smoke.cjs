// Run after build: electron src/main/viewport.smoke.cjs
const { app, BaseWindow } = require('electron')
const assert = require('node:assert/strict')
const { mkdtempSync, readFileSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { createServer } = require('node:http')

const userData = mkdtempSync(join(tmpdir(), 'overrun-viewport-test-'))
app.setPath('userData', userData)
const server = createServer((_req, res) => {
  res.setHeader('Content-Type', 'text/html')
  res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#ddd}div{width:100vw;height:100vh;background:linear-gradient(90deg,#246,#acd)}</style><div>Viewport test</div>')
})
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function until(fn, label) {
  for (let i = 0; i < 100; i++) {
    const result = await fn()
    if (result) return result
    await pause(50)
  }
  throw new Error(`Timeout: ${label}`)
}

server.listen(0, '127.0.0.1', async () => {
  try {
    const url = `http://127.0.0.1:${server.address().port}/`
    writeFileSync(join(app.getPath('userData'), 'session.json'), JSON.stringify({ tabs: [url, `${url}second`], activeIndex: 0 }))
    require('../../out/main/index.js')
    await app.whenReady()
    const win = await until(() => BaseWindow.getAllWindows()[0], 'window')
    const chrome = await until(() => win.contentView.children.find((v) => v.webContents?.getURL().includes('/chrome/')), 'chrome')
    await until(() => chrome.webContents.executeJavaScript('!!window.overrun && !!document.querySelector(".vp-trigger")'), 'React')
    await chrome.webContents.executeJavaScript("window.overrun.overlayControl('collapse')")
    const page = await until(() => win.contentView.children.find((v) => v.webContents?.getURL().startsWith('http://127.0.0.1:')), 'page')
    await until(() => !page.webContents.isLoading(), 'page load')
    const metrics = () => page.webContents.executeJavaScript('({w:innerWidth,h:innerHeight,dpr:devicePixelRatio,touch:navigator.maxTouchPoints,screen:screen.width,landscape:matchMedia("(orientation: landscape)").matches})')
    const apply = async (config, w, h, dpr) => {
      const result = await chrome.webContents.executeJavaScript(`window.overrun.viewportSet(${JSON.stringify(config)})`)
      assert.equal(result.ok, true, result.error)
      try {
        await until(async () => {
          const m = await metrics()
          return m.w === w && m.h === h && Math.abs(m.dpr - dpr) < 0.00001
        }, `${JSON.stringify(config)} -> ${w}x${h} DPR ${dpr}`)
      } catch (error) {
        console.error('Actual metrics', await metrics(), 'bounds', page.getBounds(), 'URL', page.webContents.getURL())
        throw error
      }
      console.log('PASS viewport', JSON.stringify(await metrics()))
    }
    await apply({ presetId: 'desktop-4k' }, 3840, 2160, 1)
    win.setSize(900, 600)
    await until(async () => (await metrics()).w === 3840, 'resize')
    await apply({ presetId: 'iphone-14' }, 393, 852, 3)
    assert.ok((await metrics()).touch > 0)
    await apply({ presetId: 'iphone-14', landscape: true }, 852, 393, 3)
    await apply({ presetId: 'custom', width: 1433, height: 977, dpr: 2, touch: true }, 1433, 977, 2)
    await apply({ presetId: 'custom', width: 977, height: 1433, dpr: 2, touch: true }, 977, 1433, 2)
    assert.deepEqual(JSON.parse(readFileSync(join(userData, 'session.json'), 'utf8')).viewport,
      { presetId: 'custom', width: 977, height: 1433, dpr: 2, mobile: false, touch: true })
    await chrome.webContents.executeJavaScript('window.overrun.navAction("reload")')
    await until(async () => !page.webContents.isLoading() && (await metrics()).w === 977, 'reload')
    await chrome.webContents.executeJavaScript('window.overrun.bookmarksBarToggle()')
    await until(async () => (await metrics()).h === 1433, 'bookmarks')
    await chrome.webContents.executeJavaScript('document.querySelector(".vp-trigger").click()')
    await until(() => chrome.webContents.executeJavaScript('!!document.querySelector("#viewport-picker")'), 'picker open')
    const layout = await chrome.webContents.executeJavaScript(`(() => {
      const p = document.querySelector('#viewport-picker').getBoundingClientRect();
      return { bottom:p.bottom, right:p.right, h:innerHeight, w:innerWidth, rows:document.querySelectorAll('.vp-device').length }
    })()`)
    assert.ok(layout.rows >= 50)
    await chrome.webContents.executeJavaScript(`(() => {
      const input = document.querySelector('input[type="search"]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Pixel');
      input.dispatchEvent(new Event('input', {bubbles:true}));
    })()`)
    await until(() => chrome.webContents.executeJavaScript('document.querySelectorAll(".vp-device").length === 5'), 'search')
    await chrome.webContents.executeJavaScript('document.querySelector(".vp-device .vp-icon").click()')
    await until(() => chrome.webContents.executeJavaScript('JSON.parse(localStorage.getItem("overrun.viewport-library.v1")).favorites.length === 1'), 'favorite saved')
    await chrome.webContents.executeJavaScript(`(() => {
      const input = document.querySelector('.vp-save input');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Oficina');
      input.dispatchEvent(new Event('input', {bubbles:true}));
    })()`)
    await until(() => chrome.webContents.executeJavaScript('!document.querySelector(".vp-save button").disabled'), 'save enabled')
    await chrome.webContents.executeJavaScript('document.querySelector(".vp-save button").click()')
    await until(() => chrome.webContents.executeJavaScript('JSON.parse(localStorage.getItem("overrun.viewport-library.v1")).saved.length === 1'), 'custom saved')
    await chrome.webContents.executeJavaScript('document.querySelector("[aria-label=\\"Cerrar selector\\"]").click()')
    chrome.webContents.reload()
    await until(() => chrome.webContents.executeJavaScript('!!document.querySelector(".vp-trigger")'), 'chrome reload')
    await chrome.webContents.executeJavaScript('document.querySelector(".vp-trigger").click()')
    await until(() => chrome.webContents.executeJavaScript('document.querySelectorAll(".vp-device").length === 56'), 'custom restored')
    await chrome.webContents.executeJavaScript(`document.querySelector('[aria-label="Eliminar Oficina"]').click()`)
    await until(() => chrome.webContents.executeJavaScript('JSON.parse(localStorage.getItem("overrun.viewport-library.v1")).saved.length === 0'), 'custom removed')
    await chrome.webContents.executeJavaScript('document.querySelector("[aria-label=\\"Cerrar selector\\"]").click()')
    await chrome.webContents.executeJavaScript('window.overrun.tabActivate("tab-1")')
    const second = await until(() => win.contentView.children.find((v) => v.webContents?.getURL().endsWith('/second')), 'second tab')
    await until(() => second.webContents.executeJavaScript('innerWidth === 977 && innerHeight === 1433'), 'second tab emulation')
    await chrome.webContents.executeJavaScript('window.overrun.tabActivate("tab-0")')
    await until(async () => (await metrics()).w === 977 && (await metrics()).h === 1433, 'tab restores emulation')
    const fit = await chrome.webContents.executeJavaScript('window.overrun.viewportSet({presetId:null})')
    assert.equal(fit.ok, true, fit.error)
    try {
      await until(async () => {
        const m = await metrics(), bounds = page.getBounds()
        return m.w === bounds.width && m.h === bounds.height && m.touch === 0
      }, 'fit restores native viewport')
    } catch (error) {
      console.error('Fit metrics', await metrics(), 'bounds', page.getBounds())
      throw error
    }
    console.log('PASS UI: bounded panel, catalog, search, favorite, custom save/reload/delete, tab switch; fit restored')
    app.exit(0)
  } catch (error) {
    console.error(error)
    app.exit(1)
  } finally {
    server.close()
  }
})
