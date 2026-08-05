import { Link } from 'react-router-dom'
import { CheckInControl } from '../components/CheckInControl'
import { PresenceBadge } from '../components/PresenceBadge'
import { useApp, useOtherParticipant } from '../context/useApp'
import { displayName, formatGymLabel, getContactGym, getGym } from '../data/mock'
import { profileImage } from '../lib/avatar'
import { getCheckedInGymId } from '../lib/presence'
import type { Conversation } from '../types'
import './MessagesPage.css'

function ConversationRow({ conversation }: { conversation: Conversation }) {
  const { user } = useApp()
  const other = useOtherParticipant(conversation)
  if (!other) return null
  const name = displayName(other)
  const gym = getContactGym(other, user?.gymIds || [])
  const gymLabel = formatGymLabel(gym)
  const time = new Date(conversation.updatedAt).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <Link to={`/app/messages/${conversation.id}`} className="conversation-row">
      <div className="avatar-wrap">
        <img src={profileImage(other)} alt={name} />
        {other.isActive ? <span className="online-dot abs" /> : null}
      </div>
      <div className="conversation-body">
        <div className="row">
          <strong>{name}</strong>
          <span className="dim time">{time}</span>
        </div>
        <div className="contact-meta">
          <PresenceBadge active={other.isActive} compact />
          {gymLabel ? <span className="gym-line">{gymLabel}</span> : null}
        </div>
        <p className="muted preview">{conversation.lastMessage}</p>
        {conversation.requestStatus !== 'accepted' ? (
          <span className="chip small">Запрос</span>
        ) : null}
      </div>
      {conversation.unreadCount > 0 ? (
        <i className="unread-badge">{conversation.unreadCount}</i>
      ) : null}
    </Link>
  )
}

export function MessagesPage() {
  const { conversations, user } = useApp()
  const sorted = [...conversations].sort(
    (a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt),
  )
  const myGym = user ? getGym(getCheckedInGymId(user)) : undefined
  const shortGym = myGym
    ? myGym.name
        .replace(/^DDX\s+/i, '')
        .replace(/^Spirit\.?\s*Fitness\s+/i, '')
        .replace(/^World Class\s+/i, '')
        .trim()
    : ''

  return (
    <main className="page messages-page">
      <header className="messages-header">
        <h1>Чаты</h1>
        <p className="muted">Сначала запрос — потом переписка.</p>
      </header>

      {user ? (
        <section className={`my-presence ${user.isActive ? 'on' : ''}`}>
          <div>
            <strong>{user.isActive ? 'Ты сейчас в зале' : 'Ты не в зале'}</strong>
            <p className="muted">
              {user.isActive
                ? `Контакты видят, что ты на тренировке${shortGym ? ` · ${shortGym}` : ''}`
                : user.gymIds.length > 1
                  ? 'Выбери зал, в котором ты сейчас'
                  : 'Отметься — и в чатах появится статус «В зале»'}
            </p>
          </div>
          <CheckInControl preferredGymId={user.homeGymId} compact />
        </section>
      ) : null}

      <div className="card-list">
        {sorted.length ? (
          sorted.map((c) => <ConversationRow key={c.id} conversation={c} />)
        ) : (
          <div className="empty-state">Пока нет диалогов. Найди человека в своём зале.</div>
        )}
      </div>
    </main>
  )
}
