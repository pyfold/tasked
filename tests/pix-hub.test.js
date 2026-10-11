const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const publicDir = path.join(__dirname, '..', 'public')
const hub = fs.readFileSync(path.join(publicDir, 'pix/index.html'), 'utf8')
const hubCss = fs.readFileSync(path.join(publicDir, 'pix/hub.css'), 'utf8')
const servedLauncher = fs.readFileSync(path.join(publicDir, 'pix-ui/launcher.js'), 'utf8')
const sharedLauncher = fs.readFileSync(path.join(__dirname, '..', '..', 'pix-ui/launcher.js'), 'utf8')
const sharedTokens = fs.readFileSync(path.join(__dirname, '..', '..', 'pix-ui/tokens.css'), 'utf8')
const servedTokens = fs.readFileSync(path.join(publicDir, 'pix-ui/tokens.css'), 'utf8')

test('Pix Hub and shared launcher use the canonical ecosystem names and hosts', () => {
  const canonicalHosts = [
    'pix-tube.duckdns.org',
    'pix-photo.duckdns.org',
    'drive.pix-hub.duckdns.org',
    'pix-hub.duckdns.org',
    'pix-note.duckdns.org',
    'pix-mail.duckdns.org',
    'pix-search.duckdns.org',
    'pix-account.duckdns.org',
    'pix-message.duckdns.org',
    'pix-study.duckdns.org',
  ]
  for (const name of canonicalHosts) {
    assert.ok(hub.includes(name), `Hub should document ${name}`)
    assert.ok(servedLauncher.includes(name), `launcher should document ${name}`)
  }
  assert.match(servedLauncher, /Pix Tube/)
  assert.doesNotMatch(hub, /pix-searsh/)
  assert.doesNotMatch(servedLauncher, /Pix Video|pix-searsh|Поиск без профиля/)
  assert.equal(servedLauncher, sharedLauncher, 'served launcher should stay in sync with the shared source')
})

test('Pix Hub distinguishes ready services from pilots and missing prerequisites', () => {
  assert.match(hub, /01 \/ 11 готов/)
  assert.match(hub, /ТЕСТИРУЕТСЯ/)
  assert.match(hub, /ЛОКАЛЬНЫЙ ПИЛОТ/)
  assert.match(hub, /Запросы передаются внешним поисковым источникам/)
  assert.match(hub, /drive\.pix-hub\.duckdns\.org/)
  assert.match(hub, /локальный макет/)
  assert.match(hub, /pix-photo\.duckdns\.org · DNS есть, TLS нужен/)
})

test('Pix Hub frames privacy and control as goals with service-specific boundaries', () => {
  const hero = hub.match(/<p>([^<]*Приватность и контроль[^<]*)<\/p>/)?.[1]
  assert.ok(hero, 'hero should include a privacy and control statement')
  assert.match(hero, /Приватность и контроль — цели Pix/)
  assert.match(hero, /реальные настройки и границы данных зависят от каждого сервиса/)
  assert.doesNotMatch(hero, /гарантируем|полная приватность|все данные защищены/i)
})

test('pilot and blocked services are never exposed as production-ready in the launcher', () => {
  for (const [name, host] of [
    ['Pix Message', 'pix-message.duckdns.org'],
    ['Pix Photos', 'pix-photo.duckdns.org'],
    ['Pix Notes', 'pix-note.duckdns.org'],
    ['Pix Search', 'pix-search.duckdns.org'],
    ['Pix Tube', 'pix-tube.duckdns.org'],
    ['Pix Mail', 'pix-mail.duckdns.org'],
    ['Pix Account', 'pix-account.duckdns.org'],
    ['Pix Hub', 'pix-hub.duckdns.org'],
  ]) {
    const entry = servedLauncher.match(new RegExp(`\\{name:'${name}'[^\\n]*`))?.[0]
    assert.ok(entry, `launcher should define ${name}`)
    assert.ok(entry.includes(host), `${name} should keep its exact canonical host`)
    assert.doesNotMatch(entry, /status:'ready'/, `${name} must not be marked production-ready`)
  }
  assert.match(servedLauncher, /data-state="\$\{item\.status \|\| 'planned'\}"/)
  assert.match(servedLauncher, /item\.status === 'pilot' \? ' · пилот' : ''/)
  assert.match(servedLauncher, /DNS есть, TLS нужен/)
  assert.match(hub, /ЛОКАЛЬНЫЙ ПРОТОТИП/)
  assert.match(hub, /ЛОКАЛЬНЫЙ ПИЛОТ/)
  assert.match(hub, /DNS есть, TLS нужен/)
})

test('Pix launcher exposes its disclosure state and keyboard close behavior', () => {
  assert.match(servedLauncher, /aria-expanded="false"/)
  assert.match(servedLauncher, /aria-controls="pix-launcher-menu"/)
  assert.match(servedLauncher, /event\.key === 'Escape'/)
  assert.match(servedLauncher, /button\.focus\(\)/)
})

test('Pix launcher menu remains reachable on short mobile screens', () => {
  assert.match(sharedTokens, /max-height:min\(70dvh,32rem\)/)
  assert.match(sharedTokens, /overflow-y:auto/)
  assert.match(sharedTokens, /min-height:44px/)
  assert.match(sharedTokens, /\.pix-launcher__item:hover,\.pix-launcher__item:focus-visible/)
})

test('Pix Hub layout wraps on phones, and long hosts and focus indicators stay visible', () => {
  assert.match(hubCss, /@media\(max-width:760px\)/)
  assert.match(hubCss, /@media\(max-width:420px\)/)
  assert.match(hubCss, /\.pix-domain\{[^}]*overflow-wrap:anywhere/)
  assert.match(sharedTokens, /\.pix-launcher__meta\s*\{[^}]*overflow-wrap:anywhere/)
  assert.match(hubCss, /:focus-visible\{outline:2px solid var\(--pix-focus\)/)
  assert.match(sharedTokens, /:focus-visible \{ outline:2px solid var\(--pix-focus\)/)
  assert.equal(servedTokens, sharedTokens, 'served tokens should stay in sync with shared tokens')

  const focus = sharedTokens.match(/--pix-focus:\s*(#[\da-f]{6})/i)?.[1]
  assert.ok(focus, 'shared tokens should define a focus color')
  const luminance = hex => hex.slice(1).match(/[\da-f]{2}/gi)
    .map(channel => parseInt(channel, 16) / 255)
    .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0)
  const contrast = (a, b) => {
    const [bright, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (bright + 0.05) / (dark + 0.05)
  }
  for (const background of ['#101411', '#171d19']) {
    assert.ok(contrast(focus, background) >= 3, `focus ring should contrast with ${background}`)
  }
})

