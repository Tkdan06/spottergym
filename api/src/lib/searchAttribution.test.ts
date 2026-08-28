import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseSearchAttribution } from './searchAttribution.ts'

describe('parseSearchAttribution', () => {
  it('reads Yandex organic host and text=', () => {
    const got = parseSearchAttribution({
      referrer: 'https://yandex.ru/search/?text=%D0%B7%D0%BD%D0%B0%D0%BA%D0%BE%D0%BC%D1%81%D1%82%D0%B2%D0%B0+%D0%B2+%D0%B7%D0%B0%D0%BB%D0%B5',
    })
    assert.equal(got.searchEngine, 'yandex')
    assert.equal(got.paid, false)
    assert.equal(got.searchKeyword, 'знакомства в зале')
  })

  it('reads Google organic host even without q=', () => {
    const got = parseSearchAttribution({
      referrer: 'https://www.google.com/',
    })
    assert.equal(got.searchEngine, 'google')
    assert.equal(got.searchKeyword, '')
    assert.equal(got.paid, false)
  })

  it('treats yclid as paid Yandex', () => {
    const got = parseSearchAttribution({
      landingSearch: '?yclid=123&utm_source=yandex&utm_medium=cpc&utm_term=партнёр+зал',
    })
    assert.equal(got.searchEngine, 'yandex')
    assert.equal(got.paid, true)
    assert.equal(got.searchKeyword, 'партнёр зал')
  })

  it('treats gclid as paid Google', () => {
    const got = parseSearchAttribution({
      landingSearch: '?gclid=abc&utm_source=google&utm_medium=cpc',
    })
    assert.equal(got.searchEngine, 'google')
    assert.equal(got.paid, true)
  })

  it('ignores same-site referrer', () => {
    const got = parseSearchAttribution({
      referrer: 'https://spottergym.ru/lp',
    })
    assert.equal(got.searchEngine, '')
    assert.equal(got.referrerHost, 'spottergym.ru')
  })
})
