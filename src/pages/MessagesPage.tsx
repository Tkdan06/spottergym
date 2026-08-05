import { useEffect, useState } from 'react'
import { Heart, Search, UserRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { PresenceBadge } from '../components/PresenceBadge'
import { useApp, useOtherParticipant } from '../context/useApp'
import { displayName, formatGymLabel, getContactGym, getGym } from '../data/mock'
import { profileImage } from '../lib/avatar'
import { otherParticipantId } from '../lib/conversations'
import { searchFieldProps } from '../lib/inputAttrs'
import { getCheckedInGymId } from '../lib/presence'
import { formatUsername } from '../lib/username'
import type { Conversation, UserProfile } from '../types'
import './MessagesPage.css'

function ConversationRow({ conversation }: { conversation: Conversation }) {
  const { user } = useApp()
  const other = useOtherParticipant(conversation)
  const name = other ? displayName(other) : 'Собеседник'
  const gym = other ? getContactGym(other, user?.gymIds || []) : undefined
  const gymLabel = formatGymLabel(gym)
  const time = new Date(conversation.updatedAt).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <Link to={`/app/messages/${conversation.id}`} className="conversation-row">
      <div className="avatar-wrap">
        {other ? (
          <img src={profileImage(other)} alt={name} />
        ) : (
          <span className="avatar-fallback" aria-hidden>
            ?
          </span>
        )}
      </div>
      <div className="conversation-body">
        <div className="row">
          <strong>{name}</strong>
          <span className="dim time">{time}</span>
        </div>
        <div className="contact-meta">
          {other ? <PresenceBadge active={other.isActive} compact /> : null}
          {gymLabel ? <span className="gym-line">{gymLabel}</span> : null}
        </div>
        <p className="muted preview">{conversation.lastMessage}</p>
        {conversation.requestStatus !== 'accepted' ? (
          <span className="chip small">Запрос</span>
        ) : null}
      </div>
      {(conversation.unreadCount > 0 || conversation.requestStatus === 'incoming') ? (
        <i className="unread-badge">
          {conversation.unreadCount > 0 ? conversation.unreadCount : '!'}
        </i>
      ) : null}
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
          <img src={profileImage(person)} alt={displayName(person)} />
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
    blockedUserIds,
    searchUsers,
    apiOnline,
    refreshChats,
  } = useApp()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [results, setResults] = useState<UserProfile[]>([])

  useEffect(() => {
    if (!apiOnline) return
    void refreshChats().catch(() => undefined)
    const id = window.setInterval(() => {
      void refreshChats().catch(() => undefined)
    }, 5000)
    return () => window.clearInterval(id)
  }, [apiOnline, refreshChats])

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

  const sorted = [...conversations]
    .filter((c) => {
      if (!blockedUserIds.length) return true
      const otherId = otherParticipantId(c, user?.id)
      return otherId ? !blockedUserIds.includes(otherId) : true
    })
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))

  const myGym = user ? getGym(getCheckedInGymId(user)) : undefined
  const shortGym = myGym
    ? myGym.name
        .replace(/^DDX\s+/i, '')
        .replace(/^Spirit\.?\s*Fitness\s*/i, '')
        .replace(/^World Class\s+/i, '')
        .trim()
    : ''

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
          sorted.map((c) => <ConversationRow key={c.id} conversation={c} />)
        ) : (
          <div className="empty-copy" role="status">
            <p className="empty-copy-title">Пока нет диалогов</p>
            <p className="empty-copy-lead">Найди человека по @нику или в своём зале</p>
          </div>
        )}
      </div>
    </main>
  )
}
