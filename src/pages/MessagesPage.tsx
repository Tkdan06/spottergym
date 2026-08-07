import { useEffect, useRef, useState } from 'react'
import { Heart, Pin, PinOff, Search, UserRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { PresenceBadge } from '../components/PresenceBadge'
import { SmartImage } from '../components/SmartImage'
import { useApp, useOtherParticipant } from '../context/useApp'
import { displayName, formatGymLabel, getContactGym, getGym } from '../data/mock'
import { profileImage, profileImageFallback } from '../lib/avatar'
import { formatDialogTime } from '../lib/formatDialogTime'
import { searchFieldProps } from '../lib/inputAttrs'
import { getCheckedInGymId } from '../lib/presence'
import { formatUsername } from '../lib/username'
import type { Conversation, UserProfile } from '../types'
import './MessagesPage.css'

const LONG_PRESS_MS = 480

function sortConversations(list: Conversation[]) {
  return [...list].sort((a, b) => {
    const ap = a.pinned && a.pinnedAt ? +new Date(a.pinnedAt) : 0
    const bp = b.pinned && b.pinnedAt ? +new Date(b.pinnedAt) : 0
    if (ap !== bp) {
      if (ap && bp) return bp - ap
      if (ap) return -1
      if (bp) return 1
    }
    return +new Date(b.updatedAt) - +new Date(a.updatedAt)
  })
}

function ConversationRow({
  conversation,
  onLongPress,
}: {
  conversation: Conversation
  onLongPress: (c: Conversation) => void
}) {
  const { user, isBlocked } = useApp()
  const other = useOtherParticipant(conversation)
  const deleted = Boolean(other?.isDeleted) || !other
  const name = other ? displayName(other) : 'Удалённый пользователь'
  const gym = other && !other.isDeleted ? getContactGym(other, user?.gymIds || []) : undefined
  const gymLabel = formatGymLabel(gym)
  const time = formatDialogTime(conversation.updatedAt)
  const unread = Math.max(0, Number(conversation.unreadCount) || 0)
  const incoming = conversation.requestStatus === 'incoming'
  const hasUnread = unread > 0 || incoming
  const pinned = Boolean(conversation.pinned)
  const blocked = Boolean(other && isBlocked(other.id))
  const badgeLabel = unread > 0 ? (unread > 99 ? '99+' : String(unread)) : '!'
  const longTimer = useRef<number | null>(null)
  const longFired = useRef(false)

  const clearLong = () => {
    if (longTimer.current != null) {
      window.clearTimeout(longTimer.current)
      longTimer.current = null
    }
  }

  const startLong = () => {
    clearLong()
    longFired.current = false
    longTimer.current = window.setTimeout(() => {
      longFired.current = true
      longTimer.current = null
      if (navigator.vibrate) navigator.vibrate(12)
      onLongPress(conversation)
    }, LONG_PRESS_MS)
  }

  return (
    <Link
      to={`/app/messages/${conversation.id}`}
      className={`conversation-row${hasUnread ? ' is-unread' : ''}${pinned ? ' is-pinned' : ''}`}
      aria-label={
        [
          pinned ? 'Закреплён' : '',
          name,
          hasUnread ? (unread > 0 ? `${unread} непрочитанных` : 'новый запрос') : '',
        ]
          .filter(Boolean)
          .join(', ')
      }
      onPointerDown={startLong}
      onPointerUp={clearLong}
      onPointerCancel={clearLong}
      onPointerLeave={clearLong}
      onContextMenu={(e) => {
        e.preventDefault()
        onLongPress(conversation)
      }}
      onClick={(e) => {
        if (longFired.current) {
          e.preventDefault()
          longFired.current = false
        }
      }}
    >
      <div className="avatar-wrap">
        <SmartImage
          src={other ? profileImage(other) : '/images/deleted-user.svg'}
          fallbackSrc={other ? profileImageFallback(other) : '/images/deleted-user.svg'}
          alt=""
          size="avatar"
        />
        {pinned ? (
          <span className="pin-mark" aria-hidden title="Закреплён">
            <Pin size={11} />
          </span>
        ) : null}
      </div>
      <div className="conversation-body">
        <div className="row">
          <strong className={deleted ? 'dim' : undefined}>{name}</strong>
          <time
            className={`time${hasUnread ? ' is-unread' : ' dim'}`}
            dateTime={conversation.updatedAt}
          >
            {time}
          </time>
        </div>
        <div className="contact-meta">
          {other && !other.isDeleted ? <PresenceBadge active={other.isActive} compact /> : null}
          {gymLabel ? <span className="gym-line">{gymLabel}</span> : null}
        </div>
        <div className="conversation-preview-row">
          <p className={`preview${hasUnread ? ' is-unread' : ' muted'}`}>
            {conversation.lastMessage || (incoming ? 'Запрос на переписку' : 'Нет сообщений')}
          </p>
          {hasUnread ? (
            <span className="unread-badge" aria-hidden>
              {badgeLabel}
            </span>
          ) : null}
        </div>
        <div className="conversation-flags">
          {blocked ? <span className="chip small">Заблокирован</span> : null}
          {conversation.requestStatus !== 'accepted' ? (
            <span className="chip small">Запрос</span>
          ) : null}
        </div>
      </div>
    </Link>
  )
}

function FindResultCard({
  person,
  onOpen,
}: {
  person: UserProfile
  onOpen: () => void
}) {
  const { user, toggleLike, getLikesFor } = useApp()
  const likesInfo = getLikesFor(person.id)
  const isSelf = Boolean(user && person.id === user.id)

  return (
    <div className="find-user-card">
      <button type="button" className="find-user-card-main" onClick={onOpen}>
        <div className="avatar-wrap sm">
          <SmartImage
            src={profileImage(person)}
            fallbackSrc={profileImageFallback(person)}
            alt={displayName(person)}
            size="avatar"
          />
        </div>
        <div className="find-user-card-body">
          <strong>
            {displayName(person)}
            {person.privacy !== 'anonymous' ? (
              <span className="age">, {person.age}</span>
            ) : null}
          </strong>
          {person.username ? (
            <p className="dim">{formatUsername(person.username)}</p>
          ) : null}
        </div>
      </button>
      <div className="find-user-card-actions">
        {!isSelf ? (
          <button
            type="button"
            className={`find-user-like ${likesInfo.likedByMe ? 'on' : ''}`}
            onClick={() => void toggleLike(person.id)}
            aria-label={likesInfo.likedByMe ? 'Убрать лайк' : 'Лайкнуть'}
            title={likesInfo.likedByMe ? 'В лайках' : 'Лайкнуть'}
          >
            <Heart size={18} fill={likesInfo.likedByMe ? 'currentColor' : 'none'} />
          </button>
        ) : null}
        <button
          type="button"
          className="find-user-open"
          onClick={onOpen}
          aria-label="Открыть профиль"
        >
          <UserRound size={16} aria-hidden />
        </button>
      </div>
    </div>
  )
}

export function MessagesPage() {
  const {
    conversations,
    user,
    searchUsers,
    apiOnline,
    refreshChats,
    togglePinConversation,
  } = useApp()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [results, setResults] = useState<UserProfile[]>([])
  const [sheetConv, setSheetConv] = useState<Conversation | null>(null)
  const [pinBusy, setPinBusy] = useState(false)

  useEffect(() => {
    if (!apiOnline) return
    void refreshChats().catch(() => undefined)
    const id = window.setInterval(() => {
      void refreshChats().catch(() => undefined)
    }, 5000)
    return () => window.clearInterval(id)
  }, [apiOnline, refreshChats])

  useEffect(() => {
    if (!sheetConv) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSheetConv(null)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [sheetConv])

  useEffect(() => {
    const q = query.trim().replace(/^@+/, '')
    if (q.length < 2) {
      setResults([])
      setSearchError('')
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      setSearching(true)
      void searchUsers(q)
        .then((list) => {
          if (cancelled) return
          setResults(list)
          setSearchError(list.length ? '' : 'Никого не нашли')
        })
        .catch((err) => {
          if (cancelled) return
          setResults([])
          setSearchError(err instanceof Error ? err.message : 'Не удалось найти')
        })
        .finally(() => {
          if (!cancelled) setSearching(false)
        })
    }, 280)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, searchUsers])

  // Telegram: blocked chats stay in the list (history + unblock from the thread)
  const sorted = sortConversations(conversations)

  const myGym = user ? getGym(getCheckedInGymId(user)) : undefined
  const shortGym = myGym
    ? myGym.name
        .replace(/^DDX\s+/i, '')
        .replace(/^Spirit\.?\s*Fitness\s*/i, '')
        .replace(/^World Class\s+/i, '')
        .trim()
    : ''

  const onTogglePin = async () => {
    if (!sheetConv || pinBusy) return
    setPinBusy(true)
    try {
      await togglePinConversation(sheetConv.id, !sheetConv.pinned)
      setSheetConv(null)
    } finally {
      setPinBusy(false)
    }
  }

  return (
    <main className="page messages-page">
      <header className="page-header messages-top">
        <div className="page-header-text page-header-title-row">
          <h1 className="page-title">Чаты</h1>
          {user ? (
            <span className={`messages-presence-label ${user.isActive ? 'on' : ''}`}>
              {user.isActive
                ? shortGym
                  ? `Статус: в зале · ${shortGym}`
                  : 'Статус: в зале'
                : 'Статус: не в зале'}
            </span>
          ) : null}
        </div>
      </header>

      <div className="messages-find">
        <label className="app-search">
          <Search size={16} aria-hidden />
          <input
            {...searchFieldProps}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSearchError('')
            }}
            placeholder="@ник"
            maxLength={40}
            aria-label="Поиск по @нику"
            aria-busy={searching || undefined}
          />
        </label>
        {searchError ? <p className="feedback-error find-user-error">{searchError}</p> : null}
      </div>

      {results.length ? (
        <div className="find-user-result">
          {results.map((person) => (
            <FindResultCard
              key={person.id}
              person={person}
              onOpen={() => navigate(`/app/user/${person.id}`)}
            />
          ))}
        </div>
      ) : null}

      <div className="card-list">
        {sorted.length ? (
          sorted.map((c) => (
            <ConversationRow key={c.id} conversation={c} onLongPress={setSheetConv} />
          ))
        ) : (
          <div className="empty-copy" role="status">
            <p className="empty-copy-title">Пока нет диалогов</p>
            <p className="empty-copy-lead">Найди человека по @нику или в своём зале</p>
          </div>
        )}
      </div>

      {sheetConv ? (
        <div className="chat-pin-sheet" role="dialog" aria-modal="true" aria-label="Действия с чатом">
          <button
            type="button"
            className="chat-pin-sheet-backdrop"
            aria-label="Закрыть"
            onClick={() => setSheetConv(null)}
          />
          <div className="chat-pin-sheet-panel">
            <div className="chat-pin-sheet-grab" aria-hidden />
            <p className="muted chat-pin-sheet-hint">Удерживай чат, чтобы закрепить сверху</p>
            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={pinBusy}
              onClick={() => void onTogglePin()}
            >
              {sheetConv.pinned ? (
                <>
                  <PinOff size={18} aria-hidden /> Открепить
                </>
              ) : (
                <>
                  <Pin size={18} aria-hidden /> Закрепить сверху
                </>
              )}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-block"
              onClick={() => {
                const id = sheetConv.id
                setSheetConv(null)
                navigate(`/app/messages/${id}`)
              }}
            >
              Открыть чат
            </button>
            <button type="button" className="btn btn-soft btn-block" onClick={() => setSheetConv(null)}>
              Отмена
            </button>
          </div>
        </div>
      ) : null}
    </main>
  )
}
