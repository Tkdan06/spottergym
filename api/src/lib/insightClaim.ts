import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import {
  INSIGHT_PENDING_JSON,
  STALE_PENDING_MS,
  isPendingInsightOutput,
} from './insightSanitize.js'

export type InsightClaim = 'claimed' | 'busy' | 'exists'

export async function claimInsightPeriod(opts: {
  userId: string
  kind: string
  periodStart: Date
  periodEnd: Date
  inputJson: Prisma.InputJsonValue
  inputHash: string
  promptVersion?: string
}): Promise<InsightClaim> {
  const existing = await prisma.workoutAiInsight.findUnique({
    where: {
      userId_kind_periodStart: {
        userId: opts.userId,
        kind: opts.kind,
        periodStart: opts.periodStart,
      },
    },
  })
  if (existing) {
    if (isPendingInsightOutput(existing.outputJson)) {
      if (Date.now() - existing.createdAt.getTime() < STALE_PENDING_MS) return 'busy'
      await prisma.workoutAiInsight.delete({ where: { id: existing.id } }).catch(() => {})
    } else {
      return 'exists'
    }
  }
  try {
    await prisma.workoutAiInsight.create({
      data: {
        userId: opts.userId,
        kind: opts.kind,
        periodStart: opts.periodStart,
        periodEnd: opts.periodEnd,
        inputJson: opts.inputJson,
        inputHash: opts.inputHash,
        outputJson: INSIGHT_PENDING_JSON as unknown as Prisma.InputJsonValue,
        model: '',
        promptTokens: 0,
        completionTokens: 0,
        promptVersion: opts.promptVersion ?? '',
      },
    })
    return 'claimed'
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return 'busy'
    }
    throw err
  }
}

export async function releaseInsightPeriod(userId: string, kind: string, periodStart: Date) {
  await prisma.workoutAiInsight.deleteMany({
    where: { userId, kind, periodStart },
  })
}

export async function finishInsightPeriod(
  userId: string,
  kind: string,
  periodStart: Date,
  data: {
    outputJson: Prisma.InputJsonValue
    model: string
    promptTokens: number
    completionTokens: number
    promptVersion?: string
  },
) {
  await prisma.workoutAiInsight.update({
    where: {
      userId_kind_periodStart: { userId, kind, periodStart },
    },
    data: {
      outputJson: data.outputJson,
      model: data.model.slice(0, 80),
      promptTokens: data.promptTokens,
      completionTokens: data.completionTokens,
      ...(data.promptVersion != null ? { promptVersion: data.promptVersion } : {}),
    },
  })
}

export async function dropStalePendingInsight(
  userId: string,
  kind: string,
  periodStart: Date,
  createdAt: Date,
  outputJson: unknown,
) {
  if (!isPendingInsightOutput(outputJson)) return false
  if (Date.now() - createdAt.getTime() < STALE_PENDING_MS) return false
  await prisma.workoutAiInsight.deleteMany({ where: { userId, kind, periodStart } })
  return true
}

export async function invalidateUserWorkoutInsights(userId: string) {
  await prisma.workoutAiInsight.deleteMany({ where: { userId } })
}
