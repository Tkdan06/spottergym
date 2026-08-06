import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
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
import { SmartImage } from '../components/SmartImage'
import { useApp } from '../context/useApp'
import { displayName, formatGymLabel, getContactGym, getUser } from '../data/mock'
import { profileImage, profileImageFallback } from '../lib/avatar'
import { otherParticipantId } from '../lib/conversations'
import { CHAT_MESSAGE_MAX } from '../lib/fieldLimits'
import { chatComposerProps } from '../lib/inputAttrs'
import './ChatPage.css'

function formatMsgTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

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
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const threadRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const touchStartY = useRef<number | null>(null)
  const tapStart = useRef<{ x: number; y: number } | null>(null)
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

  const resizeComposer = () => {
    const el = inputRef.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 44), 120)}px`
  }

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
      // Keep latest messages visible above the keyboard
      if (keyboard > 40) {
        bottomRef.current?.scrollIntoView({ block: 'end' })
      }
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

  useEffect(() => {
    resizeComposer()
  }, [text])

  if (!conversation || !other || !user) {
    return (
      <main className="page">
        <p>Чат не найден</p>
        <Link to="/app/messages">К списку</Link>
      </main>
    )
  }

  const name = displayName(other)
  const deleted = Boolean(other.isDeleted)
  const contactGym = deleted ? undefined : getContactGym(other, user.gymIds)
  const gymLabel = formatGymLabel(contactGym)
  const waiting = conversation.requestStatus === 'pending'
  const incoming = conversation.requestStatus === 'incoming'
  const locked = waiting || deleted

  const dismissKeyboard = () => {
    inputRef.current?.blur()
  }

  const keepComposerFocused = () => {
    requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true })
      resizeComposer()
      bottomRef.current?.scrollIntoView({ block: 'end' })
    })
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || locked || busy) return
    setBusy(true)
    setError('')
    setText('')
    // Telegram: after send keyboard stays open for the next message
    inputRef.current?.focus({ preventScroll: true })
    try {
      await sendMessage(conversation.id, trimmed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить')
      setText(trimmed)
    } finally {
      setBusy(false)
      keepComposerFocused()
    }
  }

  const onComposerKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return
    // Mobile/desktop: Enter sends; Shift+Enter = newline
    e.preventDefault()
    void onSubmit(e)
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

  const onThreadTouchStart = (e: ReactTouchEvent) => {
    touchStartY.current = e.touches[0]?.clientY ?? null
  }

  const onThreadTouchMove = (e: ReactTouchEvent) => {
    if (touchStartY.current == null) return
    if (document.activeElement !== inputRef.current) return
    const y = e.touches[0]?.clientY ?? touchStartY.current
    // Swipe down on thread → hide keyboard (Telegram-like)
    if (y - touchStartY.current > 24) {
      dismissKeyboard()
      touchStartY.current = null
    }
  }

  const onThreadPointerDown = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement | null)?.closest('.chat-input')) {
      tapStart.current = null
      return
    }
    tapStart.current = { x: e.clientX, y: e.clientY }
  }

  const onThreadPointerUp = (e: ReactPointerEvent) => {
    if (!tapStart.current) return
    const dx = Math.abs(e.clientX - tapStart.current.x)
    const dy = Math.abs(e.clientY - tapStart.current.y)
    tapStart.current = null
    // Tap (not scroll) on thread → hide keyboard; send keeps focus for multi-send
    if (dx < 12 && dy < 12 && document.activeElement === inputRef.current) {
      dismissKeyboard()
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
        {deleted ? (
          <div className="chat-user">
            <div className="chat-user-avatar">
              <SmartImage
                src={profileImage(other)}
                fallbackSrc={profileImageFallback(other)}
                alt={name}
                size="avatar"
                priority
              />
            </div>
            <div>
              <strong>{name}</strong>
              <p className="chat-gym">Аккаунт удалён</p>
            </div>
          </div>
        ) : (
          <Link to={`/app/user/${other.id}`} className="chat-user">
            <div className="chat-user-avatar">
              <SmartImage
                src={profileImage(other)}
                fallbackSrc={profileImageFallback(other)}
                alt={name}
                size="avatar"
                priority
              />
            </div>
            <div>
              <strong>{name}</strong>
              {gymLabel ? <p className="chat-gym">{gymLabel}</p> : null}
              <PresenceBadge active={other.isActive} compact />
            </div>
          </Link>
        )}
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

      {error ? (
        <p className="feedback-error" style={{ margin: '0 0 8px' }}>
          {error}
        </p>
      ) : null}

      <div
        className="chat-thread"
        ref={threadRef}
        onTouchStart={onThreadTouchStart}
        onTouchMove={onThreadTouchMove}
        onPointerDown={onThreadPointerDown}
        onPointerUp={onThreadPointerUp}
        onPointerCancel={() => {
          tapStart.current = null
        }}
      >
        {thread.map((msg) => {
          const mine = msg.senderId === user.id || msg.senderId === 'me'
          const time = formatMsgTime(msg.createdAt)
          return (
            <div key={msg.id} className={`bubble ${mine ? 'mine' : 'theirs'}`}>
              <div className="bubble-body">
                {msg.text}
                {/* Spacer reserves last-line room so absolute meta never overlaps text */}
                <span
                  className="bubble-meta-spacer"
                  aria-hidden
                  style={{ width: mine ? 58 : 40 }}
                />
                <span className="bubble-meta">
                  <time dateTime={msg.createdAt}>{time}</time>
                  {mine ? <MessageTicks status={msg.status ?? 'sent'} /> : null}
                </span>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} className="chat-thread-end" />
      </div>

      <form
        className="chat-input"
        autoComplete="off"
        onSubmit={(e) => void onSubmit(e)}
      >
        <textarea
          {...chatComposerProps}
          ref={inputRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onComposerKeyDown}
          placeholder={
            waiting
              ? 'Дождитесь принятия запроса'
              : incoming
                ? 'Сначала прими запрос'
                : 'Сообщение'
          }
          disabled={locked || incoming || busy}
          maxLength={CHAT_MESSAGE_MAX}
          aria-label="Сообщение"
        />
        <button
          className="btn btn-primary"
          type="submit"
          disabled={locked || incoming || busy || !text.trim()}
          // Keep focus in composer after tap (Telegram: stay ready to type)
          onPointerDown={(e) => e.preventDefault()}
          aria-label="Отправить"
        >
          →
        </button>
      </form>
    </main>
  )
}
