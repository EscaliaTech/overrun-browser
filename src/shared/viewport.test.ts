import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { DEVICE_CATEGORIES, DEVICE_PRESETS, FIT_VIEWPORT, resolveViewport, rotateViewport, viewportGeometry } from './viewport'
import { parseViewportLibrary } from './viewport-library'

describe('catalogo multi size', () => {
  test('identificadores unicos, todas las categorias y perfiles validos', () => {
    assert.ok(DEVICE_PRESETS.length >= 50)
    assert.equal(new Set(DEVICE_PRESETS.map((p) => p.id)).size, DEVICE_PRESETS.length)
    for (const category of DEVICE_CATEGORIES) {
      assert.ok(DEVICE_PRESETS.some((p) => p.category === category.id))
    }
    for (const p of DEVICE_PRESETS) {
      assert.ok(resolveViewport({ presetId: 'custom', width: p.w, height: p.h, dpr: p.dpr }))
      assert.equal(resolveViewport({ presetId: p.id })?.width, p.w)
      assert.equal(resolveViewport({ presetId: p.id, landscape: true })?.width, p.h)
    }
  })
  test('rotar dos veces restaura perfiles y personalizados sin alterar DPR/touch', () => {
    for (const request of [
      { presetId: 'iphone-14' }, { presetId: 'desktop' },
      { presetId: 'custom', width: 1433, height: 977, dpr: 2.625, mobile: false, touch: true }
    ]) {
      const config = resolveViewport(request)!
      const rotated = resolveViewport(rotateViewport(config))!
      assert.equal(rotated.width, config.height)
      assert.equal(rotated.height, config.width)
      assert.deepEqual(resolveViewport(rotateViewport(rotated)), config)
    }
  })
  test('rechaza datos IPC invalidos sin corregir silenciosamente las medidas', () => {
    for (const value of [null, {}, { presetId: 'missing' }, { presetId: 'desktop', landscape: 'true' }]) {
      assert.equal(resolveViewport(value), null)
    }
    for (const width of [NaN, Infinity, -1, 199, 7681, 375.5, '375', null]) {
      assert.equal(resolveViewport({ presetId: 'custom', width, height: 800 }), null)
    }
    for (const dpr of [NaN, Infinity, 0, 4.1, '2']) {
      assert.equal(resolveViewport({ presetId: 'custom', width: 375, height: 800, dpr }), null)
    }
    assert.deepEqual(resolveViewport({ presetId: null }), FIT_VIEWPORT)
  })
  test('escala 4K sin mutar dimensiones logicas y ajusta la ventana', () => {
    const config = resolveViewport({ presetId: 'desktop-4k' })!
    const box = viewportGeometry(config, 1280, 800)
    assert.deepEqual(box, { x: 0, y: 40, width: 1280, height: 720, scale: 1 / 3 })
    assert.equal(config.width, 3840)
    assert.deepEqual(viewportGeometry(FIT_VIEWPORT, 1280, 800), { x: 0, y: 0, width: 1280, height: 800, scale: 1 })
  })
  test('todos los perfiles caben dentro de una ventana minima en ambas orientaciones', () => {
    for (const preset of DEVICE_PRESETS) {
      for (const landscape of [false, true]) {
        const box = viewportGeometry(resolveViewport({ presetId: preset.id, landscape })!, 900, 468)
        assert.ok(box.width + box.x <= 900)
        assert.ok(box.height + box.y <= 468)
        assert.ok(box.scale > 0 && box.scale <= 1)
      }
    }
  })
})

describe('biblioteca persistida', () => {
  test('recupera datos corruptos y descarta favoritos huerfanos', () => {
    for (const raw of [null, '{invalid', 'null', '42']) {
      assert.deepEqual(parseViewportLibrary(raw), { favorites: [], saved: [] })
    }
    assert.deepEqual(parseViewportLibrary('{"favorites":["desktop","missing","desktop"],"saved":[]}'),
      { favorites: ['desktop'], saved: [] })
  })
  test('restaura personalizados validos sin aceptar datos manipulados', () => {
    const config = resolveViewport({ presetId: 'custom', width: 1920, height: 1200 })!
    const saved = { id: 'saved-test', name: ' Oficina ', config }
    assert.deepEqual(parseViewportLibrary(JSON.stringify({
      favorites: ['saved-test'], saved: [saved, saved, { id: 'saved-bad', name: 'bad', config: { presetId: 'custom', width: null } }]
    })), { favorites: ['saved-test'], saved: [{ ...saved, name: 'Oficina' }] })
  })
})
