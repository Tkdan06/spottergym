import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  publicActorName,
  serializePublicCard,
  serializePublicUser,
  type GymPeopleCardUser,
} from './serialize.ts'

const SECRET_KEYS = [
  'email',
  'passwordHash',
  'signupIp',
  'isAdmin',
  'isMasterAdmin',
  'adminPermissions',
  'tokenVersion',
] as const

function assertNoSecrets(payload: object) {
  const keys = Object.keys(payload)
  for (const key of SECRET_KEYS) {
    assert.equal(keys.includes(key), false, `public payload must not include ${key}`)
  }
}

const now = new Date('2026-08-29T12:00:00.000Z')

function stubUser(privacy: 'open' | 'anonymous', extra: Record<string, unknown> = {}) {
  return {
    id: 'u_hidden',
    email: 'secret@example.com',
    passwordHash: 'hash',
    username: 'masha_ddx',
    instagram: 'masha.fit',
    name: 'Маша',
    age: 29,
    gender: 'female' as const,
    bio: 'Жим и кофе',
    photos: ['/media/u/photo1.jpg', '/media/u/photo2.jpg'],
    avatar: '/media/u/avatar.jpg',
    city: 'Москва',
    homeGymId: 'gym_home',
    intent: 'dating' as const,
    experienceLevel: 'pro' as const,
    interests: ['силовые'],
    sports: ['Тренажёрный зал'],
    isCoach: true,
    coachSports: ['Силовые'],
    visitSlots: [{ day: 'Пн', from: '19:00', to: '21:00' }],
    breakUntil: '2026-09-10',
    privacy,
    lookingToMeet: true,
    referralStatusVisible: false,
    referralCreditedCount: 12,
    onboardingDone: true,
    isAdmin: true,
    isMasterAdmin: false,
    adminPermissions: { viewUsers: true },
    registeredAt: now,
    lastSeenAt: now,
    signupIp: '10.0.0.1',
    deletedAt: null,
    tokenVersion: 3,
    createdAt: now,
    updatedAt: now,
    gyms: [{ gymId: 'gym_home' }, { gymId: 'gym_other' }],
    checkIns: [
      {
        gymId: 'gym_other',
        checkedInAt: now,
        expiresAt: new Date(now.getTime() + 3 * 60 * 60 * 1000),
        extendCount: 1,
        checkedOutAt: null,
      },
    ],
    ...extra,
  }
}

describe('publicActorName', () => {
  it('redacts anonymous names', () => {
    assert.equal(publicActorName({ name: 'Маша', privacy: 'anonymous' }), 'Аноним')
    assert.equal(publicActorName({ name: 'Маша', privacy: 'open' }), 'Маша')
  })
})

describe('serializePublicUser', () => {
  it('never returns email, password, admin flags or gym graph for anonymous', () => {
    const payload = serializePublicUser(stubUser('anonymous') as never)
    assertNoSecrets(payload)
    assert.equal(payload.name, 'Аноним')
    assert.equal(payload.username, '')
    assert.equal(payload.instagram, '')
    assert.equal(payload.age, 0)
    assert.equal(payload.bio, '')
    assert.deepEqual(payload.photos, [])
    assert.equal(payload.avatar, '')
    assert.deepEqual(payload.gymIds, [])
    assert.equal(payload.homeGymId, '')
    assert.equal(payload.city, '')
    assert.deepEqual(payload.sports, [])
    assert.equal(payload.isCoach, false)
    assert.deepEqual(payload.visitSlots, [])
    assert.equal(payload.lastSeenAt, '')
    assert.equal(payload.checkedInGymId, '')
    assert.equal(payload.checkedInAt, '')
    assert.equal(payload.referralCreditedCount, 0)
    assert.equal(payload.breakUntil, '2026-09-10')
    assert.equal(payload.lookingToMeet, true)
    assert.equal(payload.privacy, 'anonymous')
    assert.equal(payload.gender, 'female')
    assert.equal(payload.isActive, true)
    assert.notEqual(payload.intent, 'dating')
    assert.notEqual(payload.experienceLevel, 'pro')
    assert.equal(JSON.stringify(payload).includes('secret@example.com'), false)
    assert.equal(JSON.stringify(payload).includes('Маша'), false)
    assert.equal(JSON.stringify(payload).includes('masha_ddx'), false)
    assert.equal(JSON.stringify(payload).includes('Жим и кофе'), false)
    assert.equal(JSON.stringify(payload).includes('/media/u/'), false)
  })

  it('keeps real profile fields for open users but still strips secrets', () => {
    const payload = serializePublicUser(stubUser('open') as never)
    assertNoSecrets(payload)
    assert.equal(payload.name, 'Маша')
    assert.equal(payload.username, 'masha_ddx')
    assert.equal(payload.instagram, 'masha.fit')
    assert.deepEqual(payload.gymIds, ['gym_home', 'gym_other'])
    assert.equal(payload.checkedInGymId, 'gym_other')
    assert.equal(payload.breakUntil, '2026-09-10')
    assert.equal(JSON.stringify(payload).includes('secret@example.com'), false)
  })
})

describe('serializePublicCard', () => {
  const cardUser = (privacy: 'open' | 'anonymous'): GymPeopleCardUser => ({
    id: 'u_hidden',
    username: 'masha_ddx',
    instagram: 'masha.fit',
    name: 'Маша',
    age: 29,
    gender: 'female',
    bio: 'Жим и кофе',
    photos: ['/media/u/photo1.jpg', '/media/u/photo2.jpg'],
    avatar: '/media/u/avatar.jpg',
    homeGymId: 'gym_home',
    city: 'Москва',
    intent: 'dating',
    experienceLevel: 'pro',
    sports: ['Тренажёрный зал'],
    isCoach: true,
    coachSports: ['Силовые'],
    breakUntil: '2026-09-10',
    privacy,
    lookingToMeet: true,
    lastSeenAt: now,
    referralStatusVisible: false,
    referralCreditedCount: 12,
    checkIns: [
      {
        gymId: 'gym_floor',
        checkedInAt: now,
        expiresAt: new Date(now.getTime() + 3 * 60 * 60 * 1000),
        extendCount: 0,
      },
    ],
  })

  it('scopes anonymous presence to the viewed gym and hides identity', () => {
    const here = serializePublicCard(cardUser('anonymous'), 'gym_floor')
    assertNoSecrets(here)
    assert.equal(here.name, 'Аноним')
    assert.equal(here.instagram, '')
    assert.deepEqual(here.photos, [])
    assert.deepEqual(here.gymIds, [])
    assert.equal(here.isActive, true)
    assert.equal(here.checkedInGymId, 'gym_floor')
    assert.equal(here.checkedInAt, '')
    assert.equal(here.breakUntil, '2026-09-10')
    assert.equal(JSON.stringify(here).includes('Маша'), false)

    const elsewhere = serializePublicCard(cardUser('anonymous'), 'gym_other')
    assert.equal(elsewhere.isActive, false)
    assert.equal(elsewhere.checkedInGymId, '')
  })

  it('does not send the full photo list on the floor', () => {
    const card = serializePublicCard(cardUser('open'), 'gym_floor')
    assert.deepEqual(card.photos, ['/media/u/photo1.jpg'])
    assert.deepEqual(card.visitSlots, [])
    assert.deepEqual(card.gymIds, ['gym_floor'])
  })
})
