const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const publicDir = path.join(__dirname, '..', 'public')
const student = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8')
const teacher = fs.readFileSync(path.join(publicDir, 'teacher.html'), 'utf8')

function assertModalMarkup(source, id, labelId, descriptionId) {
  const modal = source.match(new RegExp(`<div\\b[^>]*id="${id}"[^>]*>`))?.[0]
  assert.ok(modal, `${id} should exist`)
  assert.match(modal, /role="dialog"/)
  assert.match(modal, /aria-modal="true"/)
  assert.match(modal, new RegExp(`aria-labelledby="${labelId}"`))
  assert.match(modal, /aria-hidden="true"/)
  if (descriptionId) assert.match(modal, new RegExp(`aria-describedby="${descriptionId}"`))
  assert.match(source, new RegExp(`<[^>]+id="${labelId}"[^>]*>`), `${labelId} should label the dialog`)
}

function assertKeyboardModalBehavior(source, id, closeFn) {
  const scoped = source.slice(source.indexOf(`document.getElementById('${id}').addEventListener('keydown'`))
  assert.ok(scoped.length > 0, `${id} should handle keyboard input`)
  const keydown = scoped.slice(0, scoped.indexOf(".addEventListener('click'"))
  assert.match(keydown, new RegExp(`event\\.key === 'Escape'[\\s\\S]*?event\\.preventDefault\\(\\)[\\s\\S]*?\\b${closeFn}\\(\\)`))
  assert.match(keydown, /event\.key !== 'Tab'/)
  assert.match(keydown, /event\.shiftKey && document\.activeElement === first[\s\S]*?last\.focus\(\)/)
  assert.match(keydown, /!event\.shiftKey && document\.activeElement === last[\s\S]*?first\.focus\(\)/)
}

test('student sign-in modal exposes a named dialog and accessible form labels', () => {
  assertModalMarkup(student, 'authModal', 'authTitle', 'authWhy')
  assert.match(student, /<label for="authEmail"/)
  assert.match(student, /<label for="emailCode"/)
  assert.match(student, /id="authEmail"[^>]*type="email"/)
})

test('topic settings modal exposes a named dialog and keyboard-operable controls', () => {
  assertModalMarkup(teacher, 'topicModal', 'topicModalTitle')
  assert.match(teacher, /id="topicModalTitle"/)
  assert.match(teacher, /id="etTitle"/)
  assert.match(teacher, /id="etDesc"/)
  assert.match(teacher, /id="etTheory"/)
})

for (const [name, source, modalId, closeFn] of [
  ['student authentication', student, 'authModal', 'closeAuth'],
  ['topic settings', teacher, 'topicModal', 'closeTopicModal'],
]) {
  test(`${name} modal traps Tab, closes on Escape/backdrop, and restores focus`, () => {
    assertKeyboardModalBehavior(source, modalId, closeFn)
    const modalClick = source.slice(source.indexOf(`document.getElementById('${modalId}').addEventListener('click'`))
    assert.match(modalClick, new RegExp(`event\\.target === event\\.currentTarget[\\s\\S]*?\\b${closeFn}\\(\\)`))
    assert.match(source, /modalFocusState\.set\(modal, trigger instanceof HTMLElement \? trigger : document\.activeElement\)/)
    assert.match(source, /const previous = modalFocusState\.get\(modal\)[\s\S]*?previous\.isConnected\) previous\.focus\(\)/)
    assert.match(source, /modal\.setAttribute\('aria-hidden', 'false'\)/)
    assert.match(source, /modal\.setAttribute\('aria-hidden', 'true'\)/)
  })
}

