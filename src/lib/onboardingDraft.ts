import type { ExperienceLevel, Intent, PrivacyMode, VisitSlot } from '../types'
import { loadJson, saveJson } from './storage'

const STORAGE_KEY = 'spotter.onboarding.draft'

export type OnboardingDraft = {
  userId: string
  step: number
  city: string
  gymIds: string[]
  age: number | ''
  bio: string
  intent: Intent | null
  experienceLevel: ExperienceLevel | null
  sports: string[]
  lookingToMeet: boolean
  privacy: PrivacyMode
  visitSlots: VisitSlot[]
  gymQuery: string
  gymNetwork: string
}

export function loadOnboardingDraft(userId: string): OnboardingDraft | null {
  const raw = loadJson<OnboardingDraft | null>(STORAGE_KEY, null)
  if (!raw || raw.userId !== userId) return null
  return raw
}

export function saveOnboardingDraft(draft: OnboardingDraft) {
  saveJson(STORAGE_KEY, draft)
}

export function clearOnboardingDraft() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
