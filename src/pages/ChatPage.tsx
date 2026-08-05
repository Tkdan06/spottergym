import {
  type FormEvent,
  type TouchEvent as ReactTouchEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { MessageTicks } from '../components/MessageTicks'
import { PresenceBadge } from '../components/PresenceBadge'
import { useApp } from '../context/useApp'
import { displayName, formatGymLabel, getContactGym, getUser } from '../data/mock'
import { profileImage } from '../lib/avatar'
import { otherParticipantId } from '../lib/conversations'
import { CHAT_MESSAGE_MAX } from '../lib/fieldLimits'
import { messageFieldProps } from '../lib/inputAttrs'
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
    apiOnline,
    refreshThread,
    refreshChats,
  } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const backTo =
    typeof (location.state as { from?: unknown } | null)?.from === 'string'
      ? (location.state as { from: string }).from
      : null
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const threadRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const touchStartY = useRef<number | null>(null)
  const conversation = conversations.find((c) => c.id === conversationId)
  const otherId = conversation ? otherParticipantId(conversation, user?.id) : ''
  const other =
    (otherId ? directory.find((u) => u.id === otherId) : undefined) ??
    (otherId ? getUser(otherId) : undefined)

  const thread = useMemo(
    () =>
      messages
        .filter((m) => m.conversationId === conversationId)
        .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)),
    [messages, conversationId],
  )

  useEffect(() => {
    if (!conversationId || !apiOnline) return
    void refreshThread(conversationId).catch(() => undefined)
    void markRead(conversationId)
  }, [conversationId, apiOnline, refreshThread, markRead])

  /** Poll like a messenger while the thread is open */
  useEffect(() => {
    if (!conversationId || !apiOnline) return
    const id = window.setInterval(() => {
      void refreshThread(conversationId).catch(() => undefined)
    }, 3000)
    return () => window.clearInterval(id)
  }, [conversationId, apiOnline, refreshThread])

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
  const waiting = conversation.requestStatus === 'pending'
  const incoming = conversation.requestStatus === 'incoming'
  const locked = waiting

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || locked || busy) return
    setBusy(true)
    setError('')
    setText('')
    inputRef.current?.focus({ preventScroll: true })
    try {
      await sendMessage(conversation.id, trimmed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить')
      setText(trimmed)
    } finally {
      setBusy(false)
      requestAnimationFrame(() => {
        inputRef.current?.focus({ preventScroll: true })
        bottomRef.current?.scrollIntoView({ block: 'end' })
      })
    }
  }

  const onAccept = async () => {
    setBusy(true)
    setError('')
    try {
      await acceptRequest(conversation.id)
      await refreshChats()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось принять')
    } finally {
      setBusy(false)
    }
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
        <button
          type="button"
          className="icon-btn"
          aria-label="Назад"
          onClick={() => {
            if (backTo) {
              navigate(backTo)
              return
            }
            if (window.history.length > 1) {
              navigate(-1)
              return
            }
            navigate('/app/messages')
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <Link to={`/app/user/${other.id}`} className="chat-user">
          <div className="chat-user-avatar">
            <img src={profileImage(other)} alt={name} />
          </div>
          <div>
            <strong>{name}</strong>
            {gymLabel ? <p className="chat-gym">{gymLabel}</p> : null}
            <PresenceBadge active={other.isActive} compact />
          </div>
        </Link>
      </header>

      {waiting ? (
        <div className="request-banner">
          <p>Запрос отправлен. Переписка откроется, когда собеседник примет его.</p>
        </div>
      ) : null}

      {incoming ? (
        <div className="request-banner">
          <p>Тебе написали — прими запрос, чтобы ответить.</p>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void onAccept()}
          >
            Принять запрос
          </button>
        </div>
      ) : null}

      {error ? <p className="feedback-error" style={{ margin: '0 16px' }}>{error}</p> : null}

      <div
        className="chat-thread"
        ref={threadRef}
        onTouchStart={onThreadTouchStart}
        onTouchMove={onThreadTouchMove}
        onPointerDown={(e) => {
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

      <form className="chat-input" onSubmit={(e) => void onSubmit(e)}>
        <input
          {...messageFieldProps}
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            waiting
              ? 'Дождитесь принятия запроса'
              : incoming
                ? 'Сначала прими запрос'
                : 'Сообщение'
          }
          disabled={locked || incoming || busy}
          maxLength={CHAT_MESSAGE_MAX}
        />
        <button
          className="btn btn-primary"
          type="submit"
          disabled={locked || incoming || busy || !text.trim()}
          onMouseDown={(e) => e.preventDefault()}
        >
          →
        </button>
      </form>
    </main>
  )
}
