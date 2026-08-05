import { SEED_CONVERSATIONS, SEED_MESSAGES, USERS } from '../data/mock'
import type { AppUser, Conversation, Message, UserProfile } from '../types'
import { normalizeEmail } from './adminConfig'
import { otherParticipantId } from './conversations'
import { isDemoAccount } from './demoAccount'
import { SEED_LIKES, normalizeLikesMap, type LikesMap } from './likes'
import { normalizeMessages } from './messages'
import { ensureDemoFeedbackTickets } from './feedback'
import { loadNotificationPrefsForUser, loadNotificationsForUser } from './notifications'
import { loadJson, saveJson } from './storage'

const accountProfileKey = (email: string) => `spotter.account:${normalizeEmail(email)}`
const chatsKey = (email: string) => `spotter.conversations:${normalizeEmail(email)}`
const msgsKey = (email: string) => `spotter.messages:${normalizeEmail(email)}`
const likesKey = (email: string) => `spotter.likes:${normalizeEmail(email)}`
const contactsKey = (email: string) => `spotter.contacts:${normalizeEmail(email)}`

export type AccountBags = {
  conversations: Conversation[]
  messages: Message[]
  likes: LikesMap
  contacts: UserProfile[]
}

export function saveAccountProfile(user: AppUser) {
  saveJson(accountProfileKey(user.email), user)
}

export function loadAccountProfile(email: string): AppUser | null {
  const raw = loadJson<AppUser | null>(accountProfileKey(email), null)
  return raw && typeof raw === 'object' ? raw : null
}

const SEED_CONVERSATION_IDS = new Set(SEED_CONVERSATIONS.map((c) => c.id))

function emptyBags(): AccountBags {
  return {
    conversations: [],
    messages: [],
    likes: normalizeLikesMap({}, false),
    contacts: [],
  }
}

function persistBags(ck: string, mk: string, lk: string, nk: string, bags: AccountBags) {
  saveJson(ck, bags.conversations)
  saveJson(mk, bags.messages)
  saveJson(lk, bags.likes)
  saveJson(nk, bags.contacts)
}

function loadContacts(email: string): UserProfile[] {
  const raw = loadJson<UserProfile[] | null>(contactsKey(email), null)
  return Array.isArray(raw) ? raw.filter((u) => u && typeof u.id === 'string') : []
}

/** Keep chat list renderable: merge saved contacts + seed peers from conversations. */
export function resolveContacts(
  conversations: Conversation[],
  contacts: UserProfile[],
  userId?: string | null,
): UserProfile[] {
  const map = new Map(contacts.map((u) => [u.id, u]))
  for (const c of conversations) {
    const otherId = otherParticipantId(c, userId)
    const seed = otherId ? USERS.find((u) => u.id === otherId) : undefined
    if (seed && !map.has(seed.id)) map.set(seed.id, seed)
  }
  return [...map.values()]
}

/** Реальные аккаунты не должны тащить демо-переписку из старых билдов */
function looksLikeSeedData(conversations: Conversation[] | null | undefined) {
  if (!Array.isArray(conversations) || !conversations.length) return false
  return conversations.some((c) => c && SEED_CONVERSATION_IDS.has(c.id))
}

export function loadAccountBags(email: string): AccountBags {
  const demo = isDemoAccount(email)
  const ck = chatsKey(email)
  const mk = msgsKey(email)
  const lk = likesKey(email)
  const nk = contactsKey(email)

  const rawChats = loadJson<Conversation[] | null>(ck, null)
  const rawMsgs = loadJson<Message[] | null>(mk, null)
  const rawLikes = loadJson<LikesMap | null>(lk, null)
  const contacts = loadContacts(email)

  if (rawChats === null && rawMsgs === null && rawLikes === null) {
    if (demo) {
      const bags: AccountBags = {
        conversations: SEED_CONVERSATIONS.map((c) => ({ ...c })),
        messages: normalizeMessages(SEED_MESSAGES.map((m) => ({ ...m }))),
        likes: normalizeLikesMap(SEED_LIKES, true),
        contacts: [],
      }
      persistBags(ck, mk, lk, nk, bags)
      loadNotificationsForUser(email, true)
      loadNotificationPrefsForUser(email)
      ensureDemoFeedbackTickets()
      return bags
    }

    const empty = emptyBags()
    persistBags(ck, mk, lk, nk, empty)
    loadNotificationsForUser(email, false)
    loadNotificationPrefsForUser(email)
    return empty
  }

  if (!demo && looksLikeSeedData(rawChats)) {
    const empty = emptyBags()
    persistBags(ck, mk, lk, nk, empty)
    loadNotificationsForUser(email, false)
    return empty
  }

  if (demo) ensureDemoFeedbackTickets()

  const conversations = Array.isArray(rawChats)
    ? rawChats
    : demo
      ? SEED_CONVERSATIONS.map((c) => ({ ...c }))
      : []

  return {
    conversations,
    messages: normalizeMessages(
      Array.isArray(rawMsgs) ? rawMsgs : demo ? SEED_MESSAGES.map((m) => ({ ...m })) : [],
    ),
    likes: normalizeLikesMap(rawLikes, demo && rawLikes === null),
    contacts: resolveContacts(conversations, contacts),
  }
}

export function saveAccountConversations(email: string, list: Conversation[]) {
  saveJson(chatsKey(email), list)
}

export function saveAccountMessages(email: string, list: Message[]) {
  saveJson(msgsKey(email), list)
}

export function saveAccountLikes(email: string, likes: LikesMap) {
  saveJson(likesKey(email), likes)
}

export function saveAccountContacts(email: string, contacts: UserProfile[]) {
  saveJson(contactsKey(email), contacts)
}
