import type { CheckIn, Gym, User, UserGym } from '@prisma/client'
import { resolveAdminFlags } from './admin.js'

type UserWithRels = User & {
  gyms?: UserGym[]
  checkIns?: CheckIn[]
}

export function serializeUser(user: UserWithRels) {
  const flags = resolveAdminFlags(user)
  const gymIds = (user.gyms || []).map((g) => g.gymId)
  const activeCheckIn = (user.checkIns || []).find((c) => !c.checkedOutAt)
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
    lastSeenAt: user.lastSeenAt.toISOString(),
    registeredAt: user.registeredAt.toISOString(),
    onboardingDone: user.onboardingDone,
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
    lastSeenAt: full.lastSeenAt,
    verified: false,
  }

  if (full.privacy === 'anonymous') {
    return {
      ...base,
      username: '',
      name: 'Аноним',
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
