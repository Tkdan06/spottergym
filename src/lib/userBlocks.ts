import { loadJson, saveJson } from './storage'

const storageKey = (ownerId: string) => `spotter.blocked.${ownerId}`

export function loadBlockedUserIds(ownerId: string): string[] {
  if (!ownerId) return []
  const raw = loadJson<string[]>(storageKey(ownerId), [])
  return [...new Set(raw.filter(Boolean))]
}

export function saveBlockedUserIds(ownerId: string, ids: string[]) {
  if (!ownerId) return
  saveJson(storageKey(ownerId), [...new Set(ids.filter(Boolean))])
}

export function isUserBlocked(ownerId: string, targetId: string) {
  return loadBlockedUserIds(ownerId).includes(targetId)
}

export function blockUserId(ownerId: string, targetId: string) {
  if (!ownerId || !targetId || ownerId === targetId) return loadBlockedUserIds(ownerId)
  const next = [...loadBlockedUserIds(ownerId), targetId]
  saveBlockedUserIds(ownerId, next)
  return next
}

export function unblockUserId(ownerId: string, targetId: string) {
  const next = loadBlockedUserIds(ownerId).filter((id) => id !== targetId)
  saveBlockedUserIds(ownerId, next)
  return next
}

export const REPORT_REASONS = [
  { id: 'spam', label: 'Спам' },
  { id: 'abuse', label: 'Оскорбления' },
  { id: 'fake', label: 'Фейк / чужие фото' },
  { id: 'unsafe', label: 'Небезопасное поведение' },
  { id: 'other', label: 'Другое' },
] as const

export type ReportReasonId = (typeof REPORT_REASONS)[number]['id']

export function reportReasonLabel(id: ReportReasonId) {
  return REPORT_REASONS.find((r) => r.id === id)?.label ?? id
}
