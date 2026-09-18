// Criterios de aceptación de la fase 2.1 (V2-V3-ESPECIFICACION.md) contra un
// servidor local que devuelve lo que recibió.
// Run after build: electron src/main/security.smoke.cjs
const { app, BaseWindow } = require('electron')
const assert = require('node:assert/strict')
const { mkdtempSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { createServer } = require('node:http')

const userData = mkdtempSync(join(tmpdir(), 'overrun-security-test-'))
app.setPath('userData', userData)

const hits = []
const server = createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    hits.push({ url: req.url, method: req.method, headers: req.headers })
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ url: req.url, method: req.method, marca: req.headers['x-overrun-test'] ?? null }))
    return
  }
  res.setHeader('Content-Type', 'text/html')
  res.end('<!doctype html><title>security smoke</title><body>Security smoke</body>')
})

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function until(fn, label) {
  for (let i = 0; i < 200; i++) {
    const result = await fn()
    if (result) return result
    await pause(50)
  }
  throw new Error(`Timeout: ${label}`)
}

server.listen(0, '127.0.0.1', async () => {
  try {
    const base = `http://127.0.0.1:${server.address().port}`
    writeFileSync(join(app.getPath('userData'), 'session.json'), JSON.stringify({ tabs: [`${base}/`], activeIndex: 0 }))
    require('../../out/main/index.js')
    await app.whenReady()
    const win = await until(() => BaseWindow.getAllWindows()[0], 'window')
    const overlay = await until(() => win.contentView.children.find((v) => v.webContents?.getURL().includes('/overlay/')), 'overlay')
    const page = await until(() => win.contentView.children.find((v) => v.webContents?.getURL().startsWith(base)), 'page')
    await until(() => !page.webContents.isLoading(), 'page load')
    await until(() => overlay.webContents.executeJavaScript('!!window.overrun'), 'overlay preload')

    // Colector de eventos del dominio security, tal como los recibe el panel.
    await overlay.webContents.executeJavaScript(
      'window.__sec = []; window.overrun.onEvent((e) => { if (e.domain === "security") window.__sec.push(e) }); true')
    const ov = (code) => overlay.webContents.executeJavaScript(code)
    const events = () => ov('window.__sec')
    const queued = async (needle) => (await events()).find((e) => e.record.phase === 'intercepted' && e.record.url.includes(needle))
    // fetch sin await: la petición queda pausada, el resultado se guarda para después.
    const startFetch = (name, path) =>
      page.webContents.executeJavaScript(`window.__r = window.__r || {}; window.__r[${JSON.stringify(name)}] = 'pending';
        fetch(${JSON.stringify(path)}).then((r) => r.json()).then((j) => { window.__r[${JSON.stringify(name)}] = j })
          .catch((e) => { window.__r[${JSON.stringify(name)}] = 'error: ' + e.message }); true`)
    const result = (name) => page.webContents.executeJavaScript(`window.__r[${JSON.stringify(name)}]`)

    // ---- permiso: apagado por defecto -------------------------------------
    const initial = await ov('window.overrun.securitySetEnabled(true)')
    assert.equal(initial.ok, true, initial.error)
    assert.equal(initial.state.enabled, true)
    console.log('PASS permiso: se activa desde el overlay')

    // ---- criterio 1: editar query/header y verificar que el servidor recibe el cambio
    await startFetch('mod', '/api/original')
    const pending = await until(() => queued('/api/original'), 'request pausada')
    assert.equal(pending.record.redacted, true)
    const modified = await ov(`window.overrun.securityAction({ kind: 'modify', id: ${JSON.stringify(pending.record.id)},
      url: ${JSON.stringify(`${base}/api/original?mod=1`)}, headers: { 'X-Overrun-Test': 'si' } })`)
    assert.equal(modified.ok, true, modified.error)
    const modBody = await until(async () => {
      const r = await result('mod')
      return r && r !== 'pending' ? r : null
    }, 'respuesta de la petición modificada')
    assert.equal(modBody.url, '/api/original?mod=1', `el servidor recibió ${modBody.url}`)
    assert.equal(modBody.marca, 'si', 'el servidor no recibió el header agregado')
    console.log('PASS criterio 1: el servidor recibe la query y el header editados')

    // ---- criterio 2: bloquear un recurso, con causa visible ----------------
    await startFetch('block', '/api/secreto')
    const toBlock = await until(() => queued('/api/secreto'), 'request a bloquear')
    const blocked = await ov(`window.overrun.securityAction({ kind: 'block', id: ${JSON.stringify(toBlock.record.id)}, reason: 'prueba de bloqueo' })`)
    assert.equal(blocked.ok, true, blocked.error)
    await until(async () => String(await result('block')).startsWith('error'), 'la petición bloqueada falla en la página')
    assert.ok(!hits.some((h) => h.url.includes('/api/secreto')), 'la petición bloqueada llegó al servidor')
    const blockEvent = (await events()).find((e) => e.record.phase === 'blocked' && e.record.url.includes('/api/secreto'))
    assert.equal(blockEvent.record.reason, 'prueba de bloqueo')
    console.log('PASS criterio 2: bloqueo efectivo con causa en auditoría')

    // ---- respuesta simulada (fulfillRequest) -------------------------------
    await startFetch('mock', '/api/mock')
    const toMock = await until(() => queued('/api/mock'), 'request a simular')
    const filled = await ov(`window.overrun.securityAction({ kind: 'fulfill', id: ${JSON.stringify(toMock.record.id)},
      status: 201, body: ${JSON.stringify(JSON.stringify({ url: '/simulada', method: 'GET', marca: 'mock' }))},
      headers: { 'Content-Type': 'application/json' } })`)
    assert.equal(filled.ok, true, filled.error)
    const mockBody = await until(async () => {
      const r = await result('mock')
      return r && r !== 'pending' ? r : null
    }, 'respuesta simulada')
    assert.equal(mockBody.marca, 'mock')
    assert.ok(!hits.some((h) => h.url.includes('/api/mock')), 'la petición simulada llegó al servidor')
    console.log('PASS respuesta simulada: la página recibe el mock y el servidor no ve la petición')

    // ---- reglas por host/path/método: block y observe automáticos ----------
    const withRules = await ov(`window.overrun.securitySetRules([
      { id: 'r-block', host: '127.0.0.1', path: '/api/ads', method: '*', mode: 'block' },
      { id: 'r-obs', host: '127.0.0.1', path: '/api/libre', method: '*', mode: 'observe' }
    ])`)
    assert.equal(withRules.ok, true, withRules.error)
    assert.equal(withRules.state.rules.length, 2)

    await startFetch('ads', '/api/ads/banner')
    await until(async () => String(await result('ads')).startsWith('error'), 'la regla block falla la petición')
    const ruleBlock = (await events()).find((e) => e.record.ruleId === 'r-block')
    assert.equal(ruleBlock.record.phase, 'blocked')
    assert.ok(!hits.some((h) => h.url.includes('/api/ads')), 'la regla block dejó pasar la petición')

    await startFetch('libre', '/api/libre/dato')
    const libre = await until(async () => {
      const r = await result('libre')
      return r && r !== 'pending' ? r : null
    }, 'la regla observe continúa sin intervención')
    assert.equal(libre.url, '/api/libre/dato')
    const ruleObserve = (await events()).find((e) => e.record.ruleId === 'r-obs')
    assert.equal(ruleObserve.record.phase, 'continued')
    console.log('PASS reglas: block y observe resuelven solas y quedan en auditoría')

    // Con reglas, el scope de Fetch.enable se achica: lo no seleccionado ni se pausa.
    await startFetch('fuera', '/api/fuera-de-scope')
    const fuera = await until(async () => {
      const r = await result('fuera')
      return r && r !== 'pending' ? r : null
    }, 'tráfico fuera del scope de las reglas')
    assert.equal(fuera.url, '/api/fuera-de-scope')
    assert.ok(!(await events()).some((e) => e.record.url.includes('fuera-de-scope')), 'se interceptó tráfico fuera del scope')
    console.log('PASS scope: con reglas activas solo se intercepta el tráfico seleccionado')

    // ---- criterio 3: desactivar no deja requests pausados ------------------
    const noRules = await ov('window.overrun.securitySetRules([])')
    assert.equal(noRules.ok, true, noRules.error)
    await startFetch('cola', '/api/en-cola')
    await until(() => queued('/api/en-cola'), 'request en cola antes de apagar')
    const off = await ov('window.overrun.securitySetEnabled(false)')
    assert.equal(off.ok, true, off.error)
    assert.equal(off.state.enabled, false)
    assert.equal(off.state.pending, 0, 'quedaron requests pausados al desactivar')
    await until(async () => {
      const r = await result('cola')
      return r && r !== 'pending'
    }, 'la petición en cola se liberó al desactivar')
    await startFetch('post-off', '/api/post-off')
    const postOff = await until(async () => {
      const r = await result('post-off')
      return r && r !== 'pending' ? r : null
    }, 'tráfico normal tras desactivar')
    assert.equal(postOff.url, '/api/post-off')
    console.log('PASS criterio 3: al desactivar no quedan pausados y el tráfico sigue normal')

    // ---- redacción end-to-end: los secretos no salen del main --------------
    const on = await ov('window.overrun.securitySetEnabled(true)')
    assert.equal(on.ok, true, on.error)
    await page.webContents.executeJavaScript(`window.__r.secreto = 'pending';
      fetch('/api/con-secreto', { headers: { Authorization: 'Bearer supersecreto', 'X-Api-Key': 'clave-123' } })
        .then((r) => r.json()).then((j) => { window.__r.secreto = j })
        .catch((e) => { window.__r.secreto = 'error: ' + e.message }); true`)
    const conSecreto = await until(() => queued('/api/con-secreto'), 'request con headers sensibles')
    const sent = conSecreto.record.requestHeaders
    assert.equal(sent.Authorization ?? sent.authorization, '[redacted]', 'Authorization llegó al evento sin redactar')
    assert.equal(sent['X-Api-Key'] ?? sent['x-api-key'], '[redacted]', 'X-Api-Key llegó al evento sin redactar')
    assert.ok(!JSON.stringify(conSecreto).includes('supersecreto'), 'el valor del token viajó al renderer')
    await ov(`window.overrun.securityAction({ kind: 'continue', id: ${JSON.stringify(conSecreto.record.id)} })`)
    // El servidor sí recibe el header original: la redacción es solo de cara a la UI.
    await until(() => hits.some((h) => h.url === '/api/con-secreto'), 'la petición con secretos llegó al servidor')
    assert.equal(hits.find((h) => h.url === '/api/con-secreto').headers.authorization, 'Bearer supersecreto')
    console.log('PASS redacción: los headers sensibles salen redactados del main y el servidor recibe el original')

    // ---- criterio 4: navegar/cerrar pestaña durante una pausa --------------
    await startFetch('durante-nav', '/api/durante-nav')
    await until(() => queued('/api/durante-nav'), 'request pausada antes de navegar')
    await ov(`window.overrun.navigate(${JSON.stringify(`${base}/otra`)})`)
    // La navegación del documento también se intercepta (igual que en Burp): queda
    // en la cola hasta que el usuario decide o vence el timeout.
    const navPaused = await until(() => queued('/otra'), 'documento pausado al navegar')
    const cont = await ov(`window.overrun.securityAction({ kind: 'continue', id: ${JSON.stringify(navPaused.record.id)} })`)
    assert.equal(cont.ok, true, cont.error)
    await until(() => page.webContents.getURL().endsWith('/otra') && !page.webContents.isLoading(), 'navegación tras continuar')
    const afterNav = await ov('window.overrun.securitySetEnabled(false)')
    assert.equal(afterNav.state.pending, 0, 'la cola no se liberó tras navegar')
    // La petición pausada de la página anterior no quedó colgada ni rompió nada.
    assert.ok((await events()).some((e) => e.record.url.includes('/api/durante-nav') && e.record.phase !== 'intercepted'),
      'la petición pendiente de la página anterior no se resolvió')

    await ov('window.overrun.securitySetEnabled(true)')
    await ov('window.overrun.tabNew()')
    const second = await until(() => win.contentView.children.find((v) => v.webContents && v !== page && v.webContents.getURL().startsWith('http')), 'segunda pestaña')
    await ov('window.overrun.tabClose("tab-0")')
    await until(() => !win.contentView.children.includes(page), 'pestaña cerrada')
    assert.ok(second.webContents.listenerCount('destroyed') < 50, 'posible fuga de listeners')
    const afterClose = await ov('window.overrun.securitySetEnabled(false)')
    assert.equal(afterClose.ok, true, afterClose.error)
    console.log('PASS criterio 4: navegar y cerrar pestaña con cola pendiente no bloquea ni deja estado')

    // Ningún evento de la sesión filtró un header sensible.
    for (const e of await events()) {
      for (const [name, value] of Object.entries(e.record.requestHeaders)) {
        if (/cookie|authorization|api[-_]?key|token/i.test(name)) assert.equal(value, '[redacted]', `header ${name} sin redactar`)
      }
    }

    console.log('PASS security smoke: criterios 1-4 de la fase 2.1 verificados en la app')
    app.exit(0)
  } catch (error) {
    console.error(error)
    app.exit(1)
  } finally {
    server.close()
  }
})
