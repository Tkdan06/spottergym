import type { CheckIn, Gym, User, UserGym } from '@prisma/client'
import { resolveAdminFlags } from './admin.js'
import { canExtendCheckIn, resolveExpiresAt } from './checkInExpiry.js'

type UserWithRels = User & {
  gyms?: UserGym[]
  checkIns?: CheckIn[]
}

export function serializeUser(user: UserWithRels) {
  const isDeleted = Boolean(user.deletedAt)
  if (isDeleted) {
    return {
      id: user.id,
      email: user.email,
      username: '',
      name: 'Удалённый пользователь',
      age: 0,
      gender: user.gender,
      bio: '',
      photos: [] as string[],
      avatar: '',
      gymIds: [] as string[],
      homeGymId: '',
      city: '',
      intent: user.intent,
      experienceLevel: user.experienceLevel,
      interests: [] as string[],
      sports: [] as string[],
      isCoach: false,
      coachSports: [] as string[],
      visitSlots: [] as unknown[],
      breakUntil: null as string | null,
      privacy: 'open' as const,
      lookingToMeet: false,
      isActive: false,
      checkedInGymId: '',
      checkedInAt: '',
      checkedInExpiresAt: '',
      checkInExtendCount: 0,
      checkInCanExtend: false,
      lastSeenAt: user.lastSeenAt.toISOString(),
      registeredAt: user.registeredAt.toISOString(),
      onboardingDone: true,
      isDeleted: true,
      isAdmin: false,
      isMasterAdmin: false,
      canGrantAdmin: false,
      adminPermissions: resolveAdminFlags({ ...user, isAdmin: false, isMasterAdmin: false })
        .adminPermissions,
    }
  }

  const flags = resolveAdminFlags(user)
  const gymIds = (user.gyms || []).map((g) => g.gymId)
  const now = new Date()
  const openCheckIn = (user.checkIns || []).find((c) => !c.checkedOutAt)
  const expiresAt = openCheckIn
    ? resolveExpiresAt(openCheckIn.checkedInAt, openCheckIn.expiresAt)
    : null
  const activeCheckIn = openCheckIn && expiresAt && expiresAt.getTime() > now.getTime() ? openCheckIn : null
  const extendCount = activeCheckIn?.extendCount ?? 0
  const visitSlots = Array.isArray(user.visitSlots) ? user.visitSlots : []

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    name: user.name,
    age: user.age,
    gender: user.gender,
    bio: user.bio,
    photos: user.photos || [],
    avatar: user.avatar || '',
    gymIds,
    homeGymId: user.homeGymId && gymIds.includes(user.homeGymId) ? user.homeGymId : gymIds[0] || '',
    city: user.city,
    intent: user.intent,
    experienceLevel: user.experienceLevel,
    interests: user.interests || [],
    sports: user.sports || [],
    isCoach: user.isCoach,
    coachSports: user.coachSports || [],
    visitSlots,
    breakUntil: user.breakUntil,
    privacy: user.privacy,
    lookingToMeet: user.lookingToMeet,
    isActive: Boolean(activeCheckIn),
    checkedInGymId: activeCheckIn?.gymId || '',
    checkedInAt: activeCheckIn?.checkedInAt?.toISOString() || '',
    checkedInExpiresAt: activeCheckIn && expiresAt ? expiresAt.toISOString() : '',
    checkInExtendCount: activeCheckIn ? extendCount : 0,
    checkInCanExtend: Boolean(
      activeCheckIn && expiresAt && canExtendCheckIn(extendCount, expiresAt, now),
    ),
    lastSeenAt: user.lastSeenAt.toISOString(),
    registeredAt: user.registeredAt.toISOString(),
    onboardingDone: user.onboardingDone,
    isDeleted: false,
    isAdmin: flags.isAdmin,
    isMasterAdmin: flags.isMasterAdmin,
    canGrantAdmin: flags.canGrantAdmin,
    adminPermissions: flags.adminPermissions,
  }
}

/** Profile safe to show to other users (no email / admin flags). Honors anonymous privacy. */
export function serializePublicUser(user: UserWithRels) {
  const full = serializeUser(user)
  const base = {
    id: full.id,
    username: full.username,
    name: full.name,
    age: full.age,
    gender: full.gender,
    bio: full.bio,
    photos: full.photos,
    avatar: full.avatar,
    gymIds: full.gymIds,
    homeGymId: full.homeGymId,
    city: full.city,
    intent: full.intent,
    experienceLevel: full.experienceLevel,
    interests: full.interests,
    sports: full.sports,
    isCoach: full.isCoach,
    coachSports: full.coachSports,
    visitSlots: full.visitSlots,
    breakUntil: full.breakUntil,
    privacy: full.privacy,
    lookingToMeet: full.lookingToMeet,
    isActive: full.isActive,
    checkedInGymId: full.checkedInGymId,
    checkedInAt: full.checkedInAt,
    checkedInExpiresAt: full.checkedInExpiresAt,
    checkInExtendCount: full.checkInExtendCount,
    checkInCanExtend: full.checkInCanExtend,
    lastSeenAt: full.lastSeenAt,
    isDeleted: Boolean(full.isDeleted),
    verified: false,
  }

  if (full.isDeleted) {
    return {
      ...base,
      username: '',
      name: 'Удалённый пользователь',
      age: 0,
      bio: '',
      photos: [] as string[],
      avatar: '',
      interests: [] as string[],
      sports: [] as string[],
      isCoach: false,
      coachSports: [] as string[],
      visitSlots: [] as unknown[],
      lookingToMeet: false,
      isActive: false,
      isDeleted: true,
    }
  }

  if (full.privacy === 'anonymous') {
    // Presence only — no gym graph / city / intent / lastSeen leakage
    return {
      ...base,
      username: '',
      name: 'Аноним',
      age: 0,
      gender: full.gender,
      bio: '',
      photos: [] as string[],
      avatar: '',
      gymIds: [] as string[],
      homeGymId: '',
      city: '',
      intent: 'both' as const,
      experienceLevel: 'confident' as const,
      interests: [] as string[],
      sports: [] as string[],
      isCoach: false,
      coachSports: [] as string[],
      visitSlots: [] as unknown[],
      // Keep real flag so @ник → «Написать» works when the user is open to chat
      lookingToMeet: full.lookingToMeet,
      checkedInAt: '',
      checkedInExpiresAt: '',
      checkInExtendCount: 0,
      checkInCanExtend: false,
      lastSeenAt: '',
      // Keep gym-scoped presence (people route rewrites isActive for the viewed club)
      isActive: full.isActive,
      checkedInGymId: full.checkedInGymId,
      breakUntil: full.breakUntil,
      privacy: 'anonymous' as const,
    }
  }

  return base
}

export function serializeGym(
  gym: Gym,
  stats?: { membersCount: number; activeNow: number },
) {
  return {
    id: gym.id,
    name: gym.name,
    network: gym.network,
    city: gym.city,
    district: gym.district,
    address: gym.address,
    image: gym.image,
    lat: gym.lat,
    lng: gym.lng,
    membersCount: stats?.membersCount ?? 0,
    activeNow: stats?.activeNow ?? 0,
  }
}
