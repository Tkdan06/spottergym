import { addMoscowDays, moscowDayKey, moscowDayStartUtc } from './adminAnalytics.js'
import { pooledDayN, type RetentionCell } from './adminCohortsMath.js'

export const MIN_GYM_CORRELATION = 8
export const NO_HOME_GYM_ID = 'no_home_gym'
const MSK_DAY_MS = 24 * 60 * 60 * 1000

export type GymSortKey = 'activeUsers' | 'retention' | 'social' | 'growth'

export type GymDensityBucket = {
  label: string
  gyms: number
}

export type GymRow = {
  id: string
  name: string
  network: string
  city: string
  catalog: boolean
  totalUsers: number
  members: number
  activeUsers: number
  activeToday: number
  wau: number
  mau: number
  r7: RetentionCell
  r30: RetentionCell
  socialActors: number
  socialActions: number
  socialRate: number | null
  chats: number
  workouts: number
  checkIns: number
  viewedUsers: number
  viewedOtherUsers: number
  growth: number
  lowDensity: boolean
  empty: boolean
}

export type GymScatterPoint = {
  id: string
  name: string
  activeUsers: number
  socialRate: number | null
  r7: number | null
  r7Eligible: number
}

export type PearsonCell = {
  n: number
  r: number | null
  thin: boolean
}

export function isGymSortKey(value: string | undefined): value is GymSortKey {
  return value === 'activeUsers' || value === 'retention' || value === 'social' || value === 'growth'
}

export function parseGymSort(raw: string | undefined): GymSortKey {
  return isGymSortKey(raw) ? raw : 'activeUsers'
}

/** Same clipped windows as Overview: lastSeen inside [from, to). */
export function activityWindowsFromRange(from: Date, to: Date, toKey: string) {
  return {
    activeFrom: from,
    todayFrom: moscowDayStartUtc(toKey),
    wauFrom: new Date(Math.max(from.getTime(), to.getTime() - 7 * MSK_DAY_MS)),
    mauFrom: new Date(Math.max(from.getTime(), to.getTime() - 30 * MSK_DAY_MS)),
    to,
  }
}

export function inRange(at: Date, from: Date, to: Date): boolean {
  const t = at.getTime()
  return t >= from.getTime() && t < to.getTime()
}

export function homeBucketId(homeGymId: string | null | undefined): string {
  return homeGymId || NO_HOME_GYM_ID
}

/** Check-in / gym card at a club that is not the user's current home gym. */
export function isViewedOther(homeGymId: string | null | undefined, viewedGymId: string): boolean {
  return homeGymId !== viewedGymId
}

export function uniqueCount(ids: Iterable<string>): number {
  return new Set(ids).size
}

export function peopleSurface(placement: string): 'home' | 'gym' | null {
  if (!placement) return null
  try {
    const meta = JSON.parse(placement) as { surface?: string }
    if (meta.surface === 'home' || meta.surface === 'gym') return meta.surface
  } catch {
    /* placement is not JSON */
  }
  return null
}

export function nearestRankPercentile(values: number[], p: number): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.min(sorted.length, Math.max(1, Math.ceil((p / 100) * sorted.length)))
  return sorted[rank - 1]
}

/** Left tail of gyms that already have ≥1 home user: 0–1 active home users. Not a product SLA. */
export function isLowDensity(totalUsers: number, activeUsers: number): boolean {
  return totalUsers > 0 && activeUsers <= 1
}

export function densityBuckets(values: number[]): GymDensityBucket[] {
  const labels = ['0', '1', '2–3', '4–9', '10–24', '25+'] as const
  const counts = [0, 0, 0, 0, 0, 0]
  for (const value of values) {
    if (value <= 0) counts[0] += 1
    else if (value === 1) counts[1] += 1
    else if (value <= 3) counts[2] += 1
    else if (value <= 9) counts[3] += 1
    else if (value <= 24) counts[4] += 1
    else counts[5] += 1
  }
  return labels.map((label, i) => ({ label, gyms: counts[i] }))
}

export function compareGymRows(a: GymRow, b: GymRow, sort: GymSortKey): number {
  const dir = (x: number, y: number) => y - x
  if (sort === 'activeUsers') {
    return dir(a.activeUsers, b.activeUsers) || dir(a.totalUsers, b.totalUsers) || a.name.localeCompare(b.name, 'ru')
  }
  if (sort === 'retention') {
    const ar = a.r7.rate ?? -1
    const br = b.r7.rate ?? -1
    return dir(ar, br) || dir(a.r7.eligible, b.r7.eligible) || dir(a.activeUsers, b.activeUsers)
  }
  if (sort === 'social') {
    return dir(a.socialActors, b.socialActors) || dir(a.socialActions, b.socialActions) || dir(a.activeUsers, b.activeUsers)
  }
  return dir(a.growth, b.growth) || dir(a.activeUsers, b.activeUsers) || a.name.localeCompare(b.name, 'ru')
}

export function sortGymRows(rows: GymRow[], sort: GymSortKey): GymRow[] {
  return [...rows].sort((a, b) => compareGymRows(a, b, sort))
}

export function pearson(xs: number[], ys: number[]): PearsonCell {
  const n = Math.min(xs.length, ys.length)
  if (n < 2) return { n, r: null, thin: n < MIN_GYM_CORRELATION }
  let sumX = 0
  let sumY = 0
  for (let i = 0; i < n; i += 1) {
    sumX += xs[i]
    sumY += ys[i]
  }
  const meanX = sumX / n
  const meanY = sumY / n
  let num = 0
  let denX = 0
  let denY = 0
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - meanX
    const dy = ys[i] - meanY
    num += dx * dy
    denX += dx * dx
    denY += dy * dy
  }
  const den = Math.sqrt(denX * denY)
  return {
    n,
    r: den === 0 ? null : num / den,
    thin: n < MIN_GYM_CORRELATION,
  }
}

export function socialRate(socialActors: number, activeUsers: number): number | null {
  if (activeUsers <= 0) return null
  return socialActors / activeUsers
}

export function buildGymRetention(
  users: { registeredAt: Date; lastSeenAt: Date }[],
  todayKey: string,
): { r7: RetentionCell; r30: RetentionCell } {
  return {
    r7: pooledDayN(users, 7, todayKey),
    r30: pooledDayN(users, 30, todayKey),
  }
}

export function networkScatter(rows: GymRow[]): GymScatterPoint[] {
  return rows
    .filter((row) => row.catalog && row.totalUsers > 0)
    .map((row) => ({
      id: row.id,
      name: row.name,
      activeUsers: row.activeUsers,
      socialRate: row.socialRate,
      r7: row.r7.rate,
      r7Eligible: row.r7.eligible,
    }))
}

export function networkCorrelations(points: GymScatterPoint[]): {
  activeVsSocial: PearsonCell
  activeVsR7: PearsonCell
  socialVsR7: PearsonCell
} {
  const socialPairs = points.filter((p) => p.socialRate != null)
  const r7Pairs = points.filter((p) => p.r7 != null)
  const both = points.filter((p) => p.socialRate != null && p.r7 != null)
  return {
    activeVsSocial: pearson(
      socialPairs.map((p) => p.activeUsers),
      socialPairs.map((p) => p.socialRate as number),
    ),
    activeVsR7: pearson(
      r7Pairs.map((p) => p.activeUsers),
      r7Pairs.map((p) => p.r7 as number),
    ),
    socialVsR7: pearson(
      both.map((p) => p.socialRate as number),
      both.map((p) => p.r7 as number),
    ),
  }
}

export function currentGymTotals(rows: GymRow[]): {
  gymsWithUsers: number
  users: number
  activeUsers: number
  socialActors: number
  socialActions: number
  chats: number
  workouts: number
  checkIns: number
  r7: RetentionCell
  r30: RetentionCell
} {
  const catalog = rows.filter((row) => row.catalog)
  return {
    gymsWithUsers: catalog.filter((row) => row.totalUsers > 0).length,
    users: catalog.reduce((sum, row) => sum + row.totalUsers, 0),
    activeUsers: catalog.reduce((sum, row) => sum + row.activeUsers, 0),
    socialActors: catalog.reduce((sum, row) => sum + row.socialActors, 0),
    socialActions: catalog.reduce((sum, row) => sum + row.socialActions, 0),
    chats: catalog.reduce((sum, row) => sum + row.chats, 0),
    workouts: catalog.reduce((sum, row) => sum + row.workouts, 0),
    checkIns: catalog.reduce((sum, row) => sum + row.checkIns, 0),
    r7: {
      day: 7,
      eligible: catalog.reduce((sum, row) => sum + row.r7.eligible, 0),
      retained: catalog.reduce((sum, row) => sum + row.r7.retained, 0),
      rate: (() => {
        const eligible = catalog.reduce((sum, row) => sum + row.r7.eligible, 0)
        const retained = catalog.reduce((sum, row) => sum + row.r7.retained, 0)
        return eligible > 0 ? retained / eligible : null
      })(),
      thin: catalog.reduce((sum, row) => sum + row.r7.eligible, 0) < MIN_GYM_CORRELATION,
    },
    r30: {
      day: 30,
      eligible: catalog.reduce((sum, row) => sum + row.r30.eligible, 0),
      retained: catalog.reduce((sum, row) => sum + row.r30.retained, 0),
      rate: (() => {
        const eligible = catalog.reduce((sum, row) => sum + row.r30.eligible, 0)
        const retained = catalog.reduce((sum, row) => sum + row.r30.retained, 0)
        return eligible > 0 ? retained / eligible : null
      })(),
      thin: catalog.reduce((sum, row) => sum + row.r30.eligible, 0) < MIN_GYM_CORRELATION,
    },
  }
}

export type GymCatalog = { id: string; name: string; network: string; city: string }

export type GymFactUser = {
  id: string
  homeGymId: string | null
  registeredAt: Date
  lastSeenAt: Date
}

export type GymFacts = {
  catalog: GymCatalog[]
  users: GymFactUser[]
  memberships: { userId: string; gymId: string }[]
  likes: { fromUserId: string }[]
  conversations: { id: string; initiatedById: string }[]
  messages: { senderId: string }[]
  workouts: { userId: string }[]
  checkIns: { userId: string; gymId: string }[]
}

type Bucket = {
  meta: GymCatalog & { catalog: boolean }
  users: GymFactUser[]
  memberIds: Set<string>
  likeActors: Set<string>
  likeCount: number
  chatIds: Set<string>
  msgSenders: Set<string>
  msgCount: number
  workoutUsers: Set<string>
  workoutCount: number
  checkInUsers: Set<string>
  checkInOtherUsers: Set<string>
  checkInCount: number
}

function emptyBucket(meta: GymCatalog & { catalog: boolean }): Bucket {
  return {
    meta,
    users: [],
    memberIds: new Set(),
    likeActors: new Set(),
    likeCount: 0,
    chatIds: new Set(),
    msgSenders: new Set(),
    msgCount: 0,
    workoutUsers: new Set(),
    workoutCount: 0,
    checkInUsers: new Set(),
    checkInOtherUsers: new Set(),
    checkInCount: 0,
  }
}

function finalizeRow(
  bucket: Bucket,
  windows: ReturnType<typeof activityWindowsFromRange>,
  todayKey: string,
): GymRow {
  const { users } = bucket
  let activeUsers = 0
  let activeToday = 0
  let wau = 0
  let mau = 0
  let growth = 0
  for (const user of users) {
    if (inRange(user.lastSeenAt, windows.activeFrom, windows.to)) activeUsers += 1
    if (inRange(user.lastSeenAt, windows.todayFrom, windows.to)) activeToday += 1
    if (inRange(user.lastSeenAt, windows.wauFrom, windows.to)) wau += 1
    if (inRange(user.lastSeenAt, windows.mauFrom, windows.to)) mau += 1
    if (inRange(user.registeredAt, windows.activeFrom, windows.to)) growth += 1
  }
  const actors = new Set<string>([...bucket.likeActors, ...bucket.msgSenders])
  const socialActions = bucket.likeCount + bucket.chatIds.size + bucket.msgCount
  const { r7, r30 } = buildGymRetention(users, todayKey)
  const totalUsers = users.length
  return {
    id: bucket.meta.id,
    name: bucket.meta.name,
    network: bucket.meta.network,
    city: bucket.meta.city,
    catalog: bucket.meta.catalog,
    totalUsers,
    members: bucket.memberIds.size,
    activeUsers,
    activeToday,
    wau,
    mau,
    r7,
    r30,
    socialActors: actors.size,
    socialActions,
    socialRate: socialRate(actors.size, activeUsers),
    chats: bucket.chatIds.size,
    workouts: bucket.workoutCount,
    checkIns: bucket.checkInCount,
    viewedUsers: bucket.checkInUsers.size,
    viewedOtherUsers: bucket.checkInOtherUsers.size,
    growth,
    lowDensity: bucket.meta.catalog && isLowDensity(totalUsers, activeUsers),
    empty: bucket.meta.catalog && totalUsers === 0,
  }
}

export type AssembledGyms = {
  gyms: GymRow[]
  viewedUsers: number
  viewedOtherUsers: number
  noHomeUsers: number
  missingCatalogUsers: number
}

export function assembleGymRows(
  facts: GymFacts,
  range: { from: Date; to: Date; toKey: string },
  todayKey: string,
  sort: GymSortKey,
): AssembledGyms {
  const catalogIds = new Set(facts.catalog.map((gym) => gym.id))
  const buckets = new Map<string, Bucket>()
  const ensure = (id: string, meta: GymCatalog & { catalog: boolean }) => {
    const existing = buckets.get(id)
    if (existing) return existing
    const created = emptyBucket(meta)
    buckets.set(id, created)
    return created
  }

  for (const gym of facts.catalog) {
    ensure(gym.id, { ...gym, catalog: true })
  }
  ensure(NO_HOME_GYM_ID, {
    id: NO_HOME_GYM_ID,
    name: 'Без зала',
    network: '—',
    city: '—',
    catalog: false,
  })

  const usersById = new Map(facts.users.map((user) => [user.id, user]))

  for (const user of facts.users) {
    const id = homeBucketId(user.homeGymId)
    const inCatalog = user.homeGymId ? catalogIds.has(user.homeGymId) : false
    const bucket = ensure(id, {
      id,
      name: inCatalog ? id : user.homeGymId ? 'Нет в каталоге' : 'Без зала',
      network: inCatalog ? '' : user.homeGymId || '—',
      city: inCatalog ? '' : '—',
      catalog: inCatalog,
    })
    bucket.users.push(user)
  }

  for (const gym of facts.catalog) {
    const bucket = buckets.get(gym.id)
    if (bucket && bucket.meta.catalog) {
      bucket.meta.name = gym.name
      bucket.meta.network = gym.network
      bucket.meta.city = gym.city
    }
  }

  for (const row of facts.memberships) {
    const bucket = buckets.get(row.gymId)
    if (bucket) bucket.memberIds.add(row.userId)
  }

  for (const like of facts.likes) {
    const user = usersById.get(like.fromUserId)
    if (!user) continue
    const bucket = buckets.get(homeBucketId(user.homeGymId))
    if (!bucket) continue
    bucket.likeActors.add(like.fromUserId)
    bucket.likeCount += 1
  }

  for (const conv of facts.conversations) {
    const user = usersById.get(conv.initiatedById)
    if (!user) continue
    const bucket = buckets.get(homeBucketId(user.homeGymId))
    if (!bucket) continue
    bucket.chatIds.add(conv.id)
    bucket.msgSenders.add(conv.initiatedById)
  }

  for (const msg of facts.messages) {
    const user = usersById.get(msg.senderId)
    if (!user) continue
    const bucket = buckets.get(homeBucketId(user.homeGymId))
    if (!bucket) continue
    bucket.msgSenders.add(msg.senderId)
    bucket.msgCount += 1
  }

  for (const workout of facts.workouts) {
    const user = usersById.get(workout.userId)
    if (!user) continue
    const bucket = buckets.get(homeBucketId(user.homeGymId))
    if (!bucket) continue
    bucket.workoutUsers.add(workout.userId)
    bucket.workoutCount += 1
  }

  const viewed = new Set<string>()
  const viewedOther = new Set<string>()
  for (const checkIn of facts.checkIns) {
    const user = usersById.get(checkIn.userId)
    if (!user) continue
    viewed.add(checkIn.userId)
    const other = isViewedOther(user.homeGymId, checkIn.gymId)
    if (other) viewedOther.add(checkIn.userId)
    const bucket = buckets.get(checkIn.gymId)
    if (!bucket) continue
    bucket.checkInUsers.add(checkIn.userId)
    bucket.checkInCount += 1
    if (other) bucket.checkInOtherUsers.add(checkIn.userId)
  }

  const windows = activityWindowsFromRange(range.from, range.to, range.toKey)
  const rows = [...buckets.values()].map((bucket) => finalizeRow(bucket, windows, todayKey))
  const catalogRows = sortGymRows(
    rows.filter((row) => row.catalog),
    sort,
  )
  const specialRows = sortGymRows(
    rows.filter((row) => !row.catalog && (row.totalUsers > 0 || row.id === NO_HOME_GYM_ID)),
    sort,
  )

  return {
    gyms: [...catalogRows, ...specialRows],
    viewedUsers: viewed.size,
    viewedOtherUsers: viewedOther.size,
    noHomeUsers: rows.find((row) => row.id === NO_HOME_GYM_ID)?.totalUsers ?? 0,
    missingCatalogUsers: rows
      .filter((row) => !row.catalog && row.id !== NO_HOME_GYM_ID)
      .reduce((sum, row) => sum + row.totalUsers, 0),
  }
}

export function densityReport(catalogRows: GymRow[]) {
  const users = catalogRows.map((row) => row.totalUsers)
  const active = catalogRows.map((row) => row.activeUsers)
  const members = catalogRows.map((row) => row.members)
  const social = catalogRows.map((row) => row.socialActors)
  return {
    usersPerGym: densityBuckets(users),
    activePerGym: densityBuckets(active),
    peopleAvailablePerGym: densityBuckets(members),
    socialPerGym: densityBuckets(social),
    percentiles: {
      users: {
        p50: nearestRankPercentile(users, 50),
        p90: nearestRankPercentile(users, 90),
      },
      active: {
        p50: nearestRankPercentile(active, 50),
        p90: nearestRankPercentile(active, 90),
      },
      members: {
        p50: nearestRankPercentile(members, 50),
        p90: nearestRankPercentile(members, 90),
      },
      socialActors: {
        p50: nearestRankPercentile(social, 50),
        p90: nearestRankPercentile(social, 90),
      },
    },
  }
}

export { moscowDayKey, addMoscowDays }
