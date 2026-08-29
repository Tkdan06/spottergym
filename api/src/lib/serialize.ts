import type { CheckIn, Gym, User, UserGym } from '@prisma/client'
import { resolveAdminFlags } from './admin.js'
import { canExtendCheckIn, resolveExpiresAt } from './checkInExpiry.js'
import { statsFromCount, type ReferralPublicStats } from './referralStats.js'

type UserWithRels = User & {
  gyms?: UserGym[]
  checkIns?: CheckIn[]
}

const EMPTY_REFERRAL: ReferralPublicStats = {
  referralCreditedCount: 0,
  referralTier: 0,
  referralTitle: '',
  referralBadge: '',
  referralChrome: 'none',
}

function referralFields(stats?: ReferralPublicStats | null) {
  const s = stats || EMPTY_REFERRAL
  return {
    referralCreditedCount: s.referralCreditedCount,
    referralTier: s.referralTier,
    referralTitle: s.referralTitle,
    referralBadge: s.referralBadge,
    referralChrome: s.referralChrome,
  }
}

function referralFromUser(
  user: Pick<User, 'referralCreditedCount' | 'referralStatusVisible'>,
  override?: ReferralPublicStats | null,
  hideIfPrivate = false,
) {
  if (hideIfPrivate && user.referralStatusVisible === false) return EMPTY_REFERRAL
  if (override) return referralFields(override)
  return referralFields(statsFromCount(user.referralCreditedCount || 0))
}

/** Name safe to show other users and to put in notifications / push. */
export function publicActorName(user: { name?: string | null; privacy?: string } | null | undefined) {
  if (!user) return 'Кто-то'
  if (user.privacy === 'anonymous') return 'Аноним'
  return user.name?.trim() || 'Кто-то'
}

export function serializeUser(
  user: UserWithRels,
  opts?: { referral?: ReferralPublicStats | null },
) {
  const isDeleted = Boolean(user.deletedAt)
  if (isDeleted) {
    return {
      id: user.id,
      email: user.email,
      username: '',
      instagram: '',
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
      referralStatusVisible: false,
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
      ...referralFromUser(user, opts?.referral),
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
    instagram: user.instagram || '',
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
    referralStatusVisible: user.referralStatusVisible !== false,
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
    ...referralFromUser(user, opts?.referral),
  }
}

/** Profile safe to show to other users (no email / admin flags). Honors anonymous privacy. */
export function serializePublicUser(
  user: UserWithRels,
  opts?: { revealAnonymous?: boolean; referral?: ReferralPublicStats | null },
) {
  const full = serializeUser(user, { referral: opts?.referral })
  const base = {
    id: full.id,
    username: full.username,
    instagram: full.instagram,
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
    ...(full.referralStatusVisible === false
      ? EMPTY_REFERRAL
      : {
          referralCreditedCount: full.referralCreditedCount,
          referralTier: full.referralTier,
          referralTitle: full.referralTitle,
          referralBadge: full.referralBadge,
          referralChrome: full.referralChrome,
        }),
  }

  if (full.isDeleted) {
    return {
      id: full.id,
      username: '',
      instagram: '',
      name: 'Удалённый пользователь',
      age: 0,
      gender: full.gender,
      bio: '',
      photos: [] as string[],
      avatar: '',
      gymIds: [] as string[],
      homeGymId: '',
      city: '',
      intent: full.intent,
      experienceLevel: full.experienceLevel,
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
      lastSeenAt: '',
      isDeleted: true,
      verified: false,
      ...EMPTY_REFERRAL,
    }
  }

  if (full.privacy === 'anonymous' && !opts?.revealAnonymous) {
    // Presence + break + chat flag only. No name, gym graph, city, schedule, lastSeen, which-gym.
    return {
      id: full.id,
      username: '',
      instagram: '',
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
      breakUntil: full.breakUntil,
      privacy: 'anonymous' as const,
      lookingToMeet: full.lookingToMeet,
      isActive: full.isActive,
      checkedInGymId: '',
      checkedInAt: '',
      checkedInExpiresAt: '',
      checkInExtendCount: 0,
      checkInCanExtend: false,
      lastSeenAt: '',
      isDeleted: false,
      verified: false,
      ...EMPTY_REFERRAL,
    }
  }

  return base
}

export type GymPeopleCardUser = {
  id: string
  username: string
  instagram: string
  name: string
  age: number
  gender: User['gender']
  bio: string
  photos: string[]
  avatar: string
  homeGymId: string | null
  city: string
  intent: User['intent']
  experienceLevel: User['experienceLevel']
  sports: string[]
  isCoach: boolean
  coachSports: string[]
  breakUntil: string | null
  privacy: User['privacy']
  lookingToMeet: boolean
  lastSeenAt: Date
  referralStatusVisible: boolean
  referralCreditedCount: number
  checkIns: Array<{
    gymId: string
    checkedInAt: Date
    expiresAt: Date | null
    extendCount: number
  }>
}

/** Floor / gym-detail card — no admin flags, no gym graph, one photo. */
export function serializePublicCard(
  user: GymPeopleCardUser,
  gymId: string,
  referralOverride?: ReferralPublicStats | null,
) {
  const now = new Date()
  const open = user.checkIns[0]
  const expiresAt = open ? resolveExpiresAt(open.checkedInAt, open.expiresAt) : null
  const activeHere = Boolean(
    open && expiresAt && expiresAt.getTime() > now.getTime() && open.gymId === gymId,
  )
  const photo = (user.photos || []).find((p) => typeof p === 'string' && p.length > 0) || ''
  const referral = referralFromUser(user, referralOverride, true)

  if (user.privacy === 'anonymous') {
    return {
      id: user.id,
      username: '',
      instagram: '',
      name: 'Аноним',
      age: 0,
      gender: user.gender,
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
      breakUntil: user.breakUntil,
      privacy: 'anonymous' as const,
      lookingToMeet: user.lookingToMeet,
      isActive: activeHere,
      checkedInGymId: activeHere ? gymId : '',
      checkedInAt: '',
      checkedInExpiresAt: '',
      checkInExtendCount: 0,
      checkInCanExtend: false,
      lastSeenAt: '',
      isDeleted: false,
      verified: false,
      ...EMPTY_REFERRAL,
    }
  }

  return {
    id: user.id,
    username: user.username,
    instagram: user.instagram || '',
    name: user.name,
    age: user.age,
    gender: user.gender,
    bio: user.bio,
    photos: photo ? [photo] : [],
    avatar: user.avatar || '',
    gymIds: [gymId],
    homeGymId: user.homeGymId || gymId,
    city: user.city,
    intent: user.intent,
    experienceLevel: user.experienceLevel,
    interests: [] as string[],
    sports: user.sports || [],
    isCoach: user.isCoach,
    coachSports: user.coachSports || [],
    visitSlots: [] as unknown[],
    breakUntil: user.breakUntil,
    privacy: user.privacy,
    lookingToMeet: user.lookingToMeet,
    isActive: activeHere,
    checkedInGymId: activeHere ? gymId : '',
    checkedInAt: activeHere && open ? open.checkedInAt.toISOString() : '',
    checkedInExpiresAt: activeHere && expiresAt ? expiresAt.toISOString() : '',
    checkInExtendCount: activeHere && open ? open.extendCount : 0,
    checkInCanExtend: Boolean(
      activeHere && open && expiresAt && canExtendCheckIn(open.extendCount, expiresAt, now),
    ),
    lastSeenAt: user.lastSeenAt.toISOString(),
    isDeleted: false,
    verified: false,
    ...referral,
  }
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
