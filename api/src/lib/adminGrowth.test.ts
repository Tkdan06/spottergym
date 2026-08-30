import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  attributeRegistration,
  classifyChannel,
  growthFunnelRates,
  isActivated,
  realKeyword,
  sourceKey,
  uniqueIds,
} from './adminGrowthMath.js'

describe('UTM / channel classification', () => {
  it('missing or blank UTM is direct', () => {
    assert.equal(classifyChannel({}), 'direct')
    assert.equal(classifyChannel({ utmSource: '   ', referrer: '' }), 'direct')
    assert.equal(sourceKey({ utmSource: null, utmMedium: undefined }), 'direct')
  })

  it('keeps a real source and treats malformed spacing as empty', () => {
    assert.equal(sourceKey({ utmSource: ' yandex ' }), 'yandex')
    assert.equal(classifyChannel({ utmSource: '\n\t' }), 'direct')
  })

  it('organic medium without source', () => {
    assert.equal(classifyChannel({ utmMedium: 'organic' }), 'organic')
    assert.equal(sourceKey({ utmMedium: 'organic' }), 'organic')
  })

  it('SEO vs paid search from engine, not invented keywords', () => {
    assert.equal(classifyChannel({ searchEngine: 'yandex', searchPaid: false }), 'seo')
    assert.equal(classifyChannel({ searchEngine: 'google', searchPaid: true }), 'paid_search')
    assert.equal(realKeyword({ searchEngine: 'yandex', searchKeyword: '' }), null)
    assert.equal(realKeyword({ searchKeyword: '  зал рядом  ' }), 'зал рядом')
  })

  it('referral from invitee or fromParam, UTM still wins', () => {
    assert.equal(classifyChannel({}, true), 'referral')
    assert.equal(classifyChannel({ fromParam: 'masha' }), 'referral')
    assert.equal(classifyChannel({ utmSource: 'instagram', fromParam: 'masha' }), 'utm')
    assert.equal(sourceKey({ fromParam: 'masha' }), 'referral')
  })
})

describe('visitors and late registration', () => {
  it('dedupes duplicate landing views to one visitor', () => {
    assert.equal(uniqueIds(['v1', 'v1', 'v1', 'v2']), 2)
  })

  it('attributes registration after a later return, not before the visit', () => {
    const view = Date.parse('2026-08-01T10:00:00.000Z')
    const later = Date.parse('2026-08-20T10:00:00.000Z')
    const earlier = Date.parse('2026-07-01T10:00:00.000Z')
    assert.equal(attributeRegistration(view, later), true)
    assert.equal(attributeRegistration(view, view), true)
    assert.equal(attributeRegistration(view, earlier), false)
  })
})

describe('activation vs meaningful', () => {
  const reg = new Date('2026-08-20T10:00:00.000Z')
  it('heartbeat 2+ minutes later is activation without a gym', () => {
    assert.equal(
      isActivated({
        registeredAt: reg,
        lastSeenAt: new Date(reg.getTime() + 3 * 60 * 1000),
        meaningful: false,
      }),
      true,
    )
    assert.equal(
      isActivated({
        registeredAt: reg,
        lastSeenAt: new Date(reg.getTime() + 30 * 1000),
        meaningful: false,
      }),
      false,
    )
  })

  it('meaningful action activates even if lastSeen equals register', () => {
    assert.equal(isActivated({ registeredAt: reg, lastSeenAt: reg, meaningful: true }), true)
  })
})

describe('growth funnel rates', () => {
  it('uses visitors as the traffic denominator', () => {
    const rates = growthFunnelRates({
      visitors: 100,
      registrations: 20,
      activation: 10,
      meaningful: 6,
      r7: 4,
      r30: 2,
    })
    assert.equal(rates.visitorToReg, 0.2)
    assert.equal(rates.regToActivation, 0.5)
    assert.equal(rates.activationToMeaningful, 0.6)
  })

  it('zero visitors stay null, not 0%', () => {
    const rates = growthFunnelRates({
      visitors: 0,
      registrations: 0,
      activation: 0,
      meaningful: 0,
      r7: 0,
      r30: 0,
    })
    assert.equal(rates.visitorToReg, null)
  })
})
