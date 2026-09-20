import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { hasActiveCheckIn } from './workoutReminders.ts'

const now = new Date('2026-09-20T12:00:00.000Z')

describe('hasActiveCheckIn', () => {
  it('suppresses a workout reminder while a check-in is still active', () => {
    assert.equal(
      hasActiveCheckIn(
        [
          {
            checkedInAt: new Date('2026-09-20T11:00:00.000Z'),
            expiresAt: new Date('2026-09-20T14:00:00.000Z'),
          },
        ],
        now,
      ),
      true,
    )
  })

  it('does not suppress a reminder for an expired check-in', () => {
    assert.equal(
      hasActiveCheckIn(
        [
          {
            checkedInAt: new Date('2026-09-20T07:00:00.000Z'),
            expiresAt: new Date('2026-09-20T10:00:00.000Z'),
          },
        ],
        now,
      ),
      false,
    )
  })
})
