import { USERS } from '../data/mock'
import type { AppUser, UserProfile } from '../types'

export type LikesMap = Record<string, string[]>

/** Стартовые лайки для демо-рейтинга в зале */
export const SEED_LIKES: LikesMap = {
  'u-masha': ['u-ivan', 'u-lera', 'u-danya', 'u-katya'],
  'u-ivan': ['u-masha', 'u-danya'],
  'u-lera': ['u-masha', 'u-ivan', 'u-anon'],
  'u-danya': ['u-ivan'],
  'u-katya': ['u-masha'],
  'u-anon': ['u-lera'],
}

export function normalizeLikesMap(raw: LikesMap | null | undefined): LikesMap {
  if (!raw || typeof raw !== 'object') return { ...SEED_LIKES }
  const next: LikesMap = {}
  for (const [userId, likers] of Object.entries(raw)) {
    if (!Array.isArray(likers)) continue
    next[userId] = [...new Set(likers.filter((id) => typeof id === 'string' && id))]
  }
  return next
}

export function getLikeCount(likes: LikesMap, userId: string) {
  return likes[userId]?.length ?? 0
}

export function hasLiked(likes: LikesMap, targetId: string, likerId: string) {
  return Boolean(likes[targetId]?.includes(likerId))
}

export function toggleLikeInMap(likes: LikesMap, targetId: string, likerId: string): LikesMap {
  if (!targetId || !likerId || targetId === likerId) return likes
  const current = likes[targetId] ?? []
  const liked = current.includes(likerId)
  const nextLikers = liked ? current.filter((id) => id !== likerId) : [...current, likerId]
  return { ...likes, [targetId]: nextLikers }
}

export function resolveLikers(
  likes: LikesMap,
  targetId: string,
  currentUser: AppUser | null,
): UserProfile[] {
  const ids = likes[targetId] ?? []
  return ids
    .map((id) => {
      if (currentUser && id === currentUser.id) return currentUser as UserProfile
      return USERS.find((u) => u.id === id)
    })
    .filter((u): u is UserProfile => Boolean(u))
}

function resolveUserById(id: string, currentUser: AppUser | null): UserProfile | undefined {
  if (currentUser && id === currentUser.id) return currentUser as UserProfile
  return USERS.find((u) => u.id === id)
}

/** Кого лайкнул пользователь — по всем залам, не только «своему» */
export function resolveOutgoingLikes(
  likes: LikesMap,
  likerId: string,
  currentUser: AppUser | null = null,
): UserProfile[] {
  if (!likerId) return []
  const found: UserProfile[] = []
  for (const [targetId, likers] of Object.entries(likes)) {
    if (targetId === likerId) continue
    if (!likers?.includes(likerId)) continue
    const person = resolveUserById(targetId, currentUser)
    if (person) found.push(person)
  }
  return found.sort((a, b) => {
    const activeDiff = Number(Boolean(b.isActive)) - Number(Boolean(a.isActive))
    if (activeDiff !== 0) return activeDiff
    return a.name.localeCompare(b.name, 'ru')
  })
}

type HallSortable = {
  id: string
  isActive?: boolean
  lastSeenAt?: string
}

function lastSeenMs(user: HallSortable) {
  if (!user.lastSeenAt) return 0
  const t = Date.parse(user.lastSeenAt)
  return Number.isFinite(t) ? t : 0
}

/**
 * Рейтинг зала:
 * 1) больше лайков — выше
 * 2) без лайков — ниже всех, у кого лайки есть
 * 3) при равных лайках — кто сейчас в зале
 * 4) затем кто был в зале позже (lastSeenAt)
 */
export function sortByLikes<T extends HallSortable>(list: T[], likes: LikesMap) {
  return [...list].sort((a, b) => {
    const likesA = getLikeCount(likes, a.id)
    const likesB = getLikeCount(likes, b.id)
    if (likesB !== likesA) return likesB - likesA

    const activeDiff = Number(Boolean(b.isActive)) - Number(Boolean(a.isActive))
    if (activeDiff !== 0) return activeDiff

    return lastSeenMs(b) - lastSeenMs(a)
  })
}

/** Место в рейтинге только у тех, у кого есть лайки */
export function getHallRank(userId: string, sorted: HallSortable[], likes: LikesMap) {
  if (getLikeCount(likes, userId) <= 0) return undefined
  let rank = 0
  for (const person of sorted) {
    if (getLikeCount(likes, person.id) <= 0) break
    rank += 1
    if (person.id === userId) return rank
  }
  return undefined
}
