import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { matchRule, parseRule, parseRules, redactBody, redactHeaders, ruleUrlPatterns } from './security'

describe('redaccion (fase 2.0)', () => {
  test('oculta headers sensibles y conserva el resto', () => {
    const out = redactHeaders({ Authorization: 'Bearer abc', Cookie: 'a=1', 'Set-Cookie': 'b=2', Accept: 'text/html' })
    assert.equal(out.Authorization, '[redacted]')
    assert.equal(out.Cookie, '[redacted]')
    assert.equal(out['Set-Cookie'], '[redacted]')
    assert.equal(out.Accept, 'text/html')
  })
  test('redacta secretos en bodies JSON y form, y corta bodies enormes', () => {
    assert.equal(redactBody('{"user":"ana","password":"hunter2"}'), '{"user":"ana","password":"[redacted]"}')
    assert.equal(redactBody('{"a":{"api_key":"x"}}'), '{"a":{"api_key":"[redacted]"}}')
    assert.equal(redactBody('user=ana&token=abc123'), 'user=ana&token=[redacted]')
    assert.match(redactBody('x'.repeat(300_000)) as string, /^\[redacted: body excede/)
    assert.equal(redactBody(undefined), undefined)
  })
})

describe('reglas por host/path/metodo (fase 2.1)', () => {
  test('rechaza reglas invalidas y normaliza las validas', () => {
    assert.equal(parseRule({ host: 'a.com', mode: 'nope' }), null)
    assert.equal(parseRule({ host: 'a.com', method: 'GET PLUS', mode: 'observe' }), null)
    assert.equal(parseRule({ host: 'a com', mode: 'observe' }), null)
    assert.equal(parseRule({ host: 'a.com', mode: 'rewrite', redirectTo: 'file:///etc/passwd' }), null)
    const rule = parseRule({ host: ' API.Example.COM ', path: '/v1', method: 'post', mode: 'block' })
    assert.deepEqual({ host: rule?.host, method: rule?.method, mode: rule?.mode }, { host: 'api.example.com', method: 'POST', mode: 'block' })
    assert.equal(parseRules([{ host: 'a.com', mode: 'observe' }, 'basura', null]).length, 1)
  })

  test('matchea por host comodin, prefijo de path y metodo', () => {
    const rules = parseRules([
      { id: 'r1', host: 'api.example.com', path: '/v1', method: 'POST', mode: 'block' },
      { id: 'r2', host: '*.example.com', path: '', method: '*', mode: 'observe' }
    ])
    assert.equal(matchRule(rules, { url: 'https://api.example.com/v1/login', method: 'post' })?.id, 'r1')
    assert.equal(matchRule(rules, { url: 'https://api.example.com/v1/login', method: 'GET' })?.id, 'r2')
    assert.equal(matchRule(rules, { url: 'https://example.com/x', method: 'GET' })?.id, 'r2')
    assert.equal(matchRule(rules, { url: 'https://otro.com/x', method: 'GET' }), null)
    assert.equal(matchRule(rules, { url: 'no-es-url', method: 'GET' }), null)
  })

  test('el scope de Fetch.enable sale de las reglas', () => {
    assert.deepEqual(ruleUrlPatterns([]), ['*'])
    const rules = parseRules([
      { host: 'api.example.com', path: '/v1', mode: 'observe' },
      { host: 'api.example.com', path: '/v1', method: 'POST', mode: 'block' }
    ])
    assert.deepEqual(ruleUrlPatterns(rules), ['*://api.example.com/v1*'])
    assert.deepEqual(ruleUrlPatterns(parseRules([{ host: '*', mode: 'pause' }, { host: 'a.com', mode: 'block' }])), ['*'])
  })
})
