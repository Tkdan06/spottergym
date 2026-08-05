import {
  type FormEvent,
  type TouchEvent as ReactTouchEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CheckInControl } from '../components/CheckInControl'
import { MessageTicks } from '../components/MessageTicks'
import { PresenceBadge } from '../components/PresenceBadge'
import { useApp } from '../context/useApp'
import { displayName, formatGymLabel, getContactGym, getGym, getUser } from '../data/mock'
import { profileImage } from '../lib/avatar'
import { getCheckedInGymId } from '../lib/presence'
import './ChatPage.css'

export function ChatPage() {
  const { conversationId = '' } = useParams()
  const {
    conversations,
    messages,
    sendMessage,
    markRead,
    acceptRequest,
    user,
    directory,
  } = useApp()
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const threadRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const touchStartY = useRef<number | null>(null)
  const conversation = conversations.find((c) => c.id === conversationId)
  const otherId = conversation?.participantIds.find((id) => id !== user?.id) ?? ''
  const other = getUser(otherId) ?? directory.find((u) => u.id === otherId)

  const thread = useMemo(
    () =>
      messages
        .filter((m) => m.conversationId === conversationId)
        .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)),
    [messages, conversationId],
  )

  useEffect(() => {
    if (conversationId) markRead(conversationId)
  }, [conversationId, markRead])

  /** Высота клавиатуры через visualViewport — композер остаётся над ней */
  useEffect(() => {
    const root = document.documentElement
    const vv = window.visualViewport
    if (!vv) return

    const sync = () => {
      const keyboard = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      root.style.setProperty('--chat-keyboard', `${keyboard}px`)
    }

    sync()
    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', sync)
    return () => {
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', sync)
      root.style.removeProperty('--chat-keyboard')
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [thread.length, conversationId])

  if (!conversation || !other || !user) {
    return (
      <main className="page">
        <p>Чат не найден</p>
        <Link to="/app/messages">К списку</Link>
      </main>
    )
  }

  const name = displayName(other)
  const contactGym = getContactGym(other, user.gymIds)
  const gymLabel = formatGymLabel(contactGym)
  const myGym = getGym(getCheckedInGymId(user))
  const myShortGym = myGym
    ? myGym.name
        .replace(/^DDX\s+/i, '')
        .replace(/^Spirit\.?\s*Fitness\s+/i, '')
        .replace(/^World Class\s+/i, '')
        .trim()
    : ''
  const locked = conversation.requestStatus === 'pending'

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || locked) return
    sendMessage(conversation.id, text)
    setText('')
    // синхронный focus — клавиатура не успевает закрыться (как в Telegram)
    inputRef.current?.focus({ preventScroll: true })
    requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true })
      bottomRef.current?.scrollIntoView({ block: 'end' })
    })
  }

  const dismissKeyboard = () => {
    inputRef.current?.blur()
  }

  const onThreadTouchStart = (e: ReactTouchEvent) => {
    touchStartY.current = e.touches[0]?.clientY ?? null
  }

  const onThreadTouchMove = (e: ReactTouchEvent) => {
    if (touchStartY.current == null) return
    if (document.activeElement !== inputRef.current) return
    const y = e.touches[0]?.clientY ?? touchStartY.current
    if (y - touchStartY.current > 28) {
      dismissKeyboard()
      touchStartY.current = null
    }
  }

  return (
    <main className="chat-page">
      <header className="chat-header">
        <button type="button" className="icon-btn" onClick={() => navigate('/app/messages')}>
          <ArrowLeft size={18} />
        </button>
        <Link to={`/app/user/${other.id}`} className="chat-user">
          <div className="chat-user-avatar">
            <img src={profileImage(other)} alt={name} />
            {other.isActive ? <span className="online-dot abs" /> : null}
          </div>
          <div>
            <strong>{name}</strong>
            {gymLabel ? <p className="chat-gym">{gymLabel}</p> : null}
            <PresenceBadge active={other.isActive} compact />
          </div>
        </Link>
      </header>

      <section className={`chat-my-presence ${user.isActive ? 'on' : ''}`}>
        <div>
          <PresenceBadge active={user.isActive} gymName={user.isActive ? myShortGym : undefined} />
          <p className="dim">
            {user.isActive
              ? 'Собеседник видит, что ты сейчас в зале'
              : user.gymIds.length > 1
                ? 'Выбери зал, где ты сейчас'
                : 'Нажми «Я в зале» — статус увидят в чате'}
          </p>
        </div>
        <CheckInControl preferredGymId={user.homeGymId} compact />
      </section>

      {locked ? (
        <div className="request-banner">
          <p>Запрос отправлен. Переписка откроется, когда собеседник примет его.</p>
          <p className="dim">В демо можно принять запрос кнопкой ниже.</p>
          <button
            type="button"
            className="btn btn-soft"
            onClick={() => acceptRequest(conversation.id)}
          >
            Принять запрос (демо)
          </button>
        </div>
      ) : null}

      <div
        className="chat-thread"
        ref={threadRef}
        onTouchStart={onThreadTouchStart}
        onTouchMove={onThreadTouchMove}
        onPointerDown={(e) => {
          // тап по ленте (не по пузырю-кнопке) — можно свернуть клавиатуру свайпом; клик не блюрит сразу
          if (e.pointerType === 'mouse' && e.target === threadRef.current) {
            dismissKeyboard()
          }
        }}
      >
        {thread.map((msg) => {
          const mine = msg.senderId === user.id || msg.senderId === 'me'
          return (
            <div key={msg.id} className={`bubble ${mine ? 'mine' : 'theirs'}`}>
              <p>{msg.text}</p>
              <div className="bubble-meta">
                <time>
                  {new Date(msg.createdAt).toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
                {mine ? <MessageTicks status={msg.status ?? 'sent'} /> : null}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} className="chat-thread-end" />
      </div>

      <form className="chat-input" onSubmit={onSubmit}>
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={locked ? 'Дождитесь принятия запроса' : 'Сообщение'}
          disabled={locked}
          enterKeyHint="send"
          autoComplete="off"
        />
        <button
          className="btn btn-primary"
          type="submit"
          disabled={locked || !text.trim()}
          // не забираем фокус у input до submit
          onMouseDown={(e) => e.preventDefault()}
        >
          →
        </button>
      </form>
    </main>
  )
}
