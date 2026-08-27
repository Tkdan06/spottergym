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
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { SubpageBack } from '../components/SubpageHeader'
import { MessageTicks } from '../components/MessageTicks'
import { PresenceBadge } from '../components/PresenceBadge'
import { SafetyActions } from '../components/SafetyActions'
import { SmartImage } from '../components/SmartImage'
import { SoftLoader } from '../components/SoftLoader'
import { useApp } from '../context/useApp'
import { displayName, formatGymLabel, getContactGym, getUser } from '../data/mock'
import { profileImage, profileImageFallback } from '../lib/avatar'
import { apiMarkConversationRead } from '../lib/apiClient'
import { otherParticipantId } from '../lib/conversations'
import { CHAT_MESSAGE_MAX } from '../lib/fieldLimits'
import { chatComposerProps } from '../lib/inputAttrs'
import { setActiveChatForPush } from '../lib/push'
import { shortGymName } from '../data/mock'
import './ChatPage.css'
import './FeedbackPage.css'

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
    isBlocked,
    unblockUser,
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
  const [hydrate, setHydrate] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [hasMore, setHasMore] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const pageRef = useRef<HTMLElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const threadRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const touchStartY = useRef<number | null>(null)
  const tapStart = useRef<{ x: number; y: number } | null>(null)
  const sendingRef = useRef(false)

  const scrollThreadToEnd = () => {
    const el = threadRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }

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
    if (!conversationId) return
    let cancelled = false
    const known = conversations.some((c) => c.id === conversationId)
    if (!apiOnline) {
      setHydrate(known ? 'ready' : 'error')
      return
    }
    setHydrate((prev) => (known && prev !== 'idle' ? prev : known ? 'ready' : 'loading'))
    void refreshThread(conversationId)
      .then((res) => {
        if (cancelled) return
        setHasMore(Boolean(res?.hasMore))
        setHydrate('ready')
        void markRead(conversationId)
      })
      .catch(() => {
        if (cancelled) return
        setHydrate(known ? 'ready' : 'error')
      })
    return () => {
      cancelled = true
    }
  }, [conversationId, apiOnline, refreshThread, markRead])

  /** Suppress OS pushes for this conversation while the chat is on screen */
  useEffect(() => {
    if (!conversationId) return

    const sync = () => {
      if (document.visibilityState === 'hidden') setActiveChatForPush(null)
      else setActiveChatForPush(conversationId)
    }

    sync()
    document.addEventListener('visibilitychange', sync)
    const onHide = () => setActiveChatForPush(null)
    window.addEventListener('pagehide', onHide)
    return () => {
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('pagehide', onHide)
      setActiveChatForPush(null)
    }
  }, [conversationId])

  /** Poll while the thread is open (inbox poll lives in AppContext) */
  useEffect(() => {
    if (!conversationId || !apiOnline) return
    const tick = () => {
      if (document.visibilityState === 'hidden') return
      void refreshThread(conversationId)
        .then(async (res) => {
          setHasMore(Boolean(res?.hasMore))
          // Stay-in-chat: mark peer messages read so the sender gets ✓✓ blue on their poll
          try {
            await apiMarkConversationRead(conversationId)
          } catch {
            /* ignore */
          }
        })
        .catch(() => undefined)
    }
    const id = window.setInterval(tick, 4000)
    return () => window.clearInterval(id)
  }, [conversationId, apiOnline, refreshThread])

  /** When returning to the tab with chat open, refresh + mark read immediately */
  useEffect(() => {
    if (!conversationId || !apiOnline) return
    const onVis = () => {
      if (document.visibilityState !== 'visible') return
      void Promise.resolve(markRead(conversationId)).catch(() => undefined)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [conversationId, apiOnline, markRead])

  /**
   * Pin the chat column to the visual viewport so the composer sits on the
   * keyboard, not in the middle of the screen.
   *
   * iOS PWA otherwise does two things at once:
   * 1. `.page` min-height: 100vh beats a smaller JS height (min-height wins over
   *    max-height), so the column stays full-screen and the field sits under
   *    the keyboard — WebKit then scrolls it toward the centre.
   * 2. Focusing the textarea scrolls the document. Combined with translateY
   *    that double-offsets the composer by ~a thumb or two.
   */
  useEffect(() => {
    const root = document.documentElement
    const body = document.body
    const page = pageRef.current
    if (!page) return

    const prevHtmlOverflow = root.style.overflow
    const prevBodyOverflow = body.style.overflow
    root.classList.add('chat-viewport-lock')
    root.style.overflow = 'hidden'
    body.style.overflow = 'hidden'

    const sync = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0)
      const vv = window.visualViewport
      const visible = Math.round(vv?.height ?? window.innerHeight)
      const offsetTop = Math.round(vv?.offsetTop ?? 0)
      const keyboard = Math.max(0, window.innerHeight - visible - offsetTop)
      const size = `${visible}px`
      page.style.minHeight = size
      page.style.height = size
      page.style.maxHeight = size
      page.style.transform = offsetTop ? `translateY(${offsetTop}px)` : ''
      page.style.paddingBottom = keyboard > 40 ? '0px' : ''
      root.style.setProperty('--chat-keyboard', `${keyboard}px`)
      if (keyboard > 40) scrollThreadToEnd()
    }

    sync()
    const vv = window.visualViewport
    vv?.addEventListener('resize', sync)
    vv?.addEventListener('scroll', sync)
    window.addEventListener('resize', sync)
    return () => {
      vv?.removeEventListener('resize', sync)
      vv?.removeEventListener('scroll', sync)
      window.removeEventListener('resize', sync)
      root.classList.remove('chat-viewport-lock')
      root.style.overflow = prevHtmlOverflow
      body.style.overflow = prevBodyOverflow
      page.style.minHeight = ''
      page.style.height = ''
      page.style.maxHeight = ''
      page.style.transform = ''
      page.style.paddingBottom = ''
      root.style.removeProperty('--chat-keyboard')
    }
  }, [conversationId, hydrate, conversation?.id, other?.id, user?.id])

  useEffect(() => {
    scrollThreadToEnd()
  }, [thread.length, conversationId])

  useEffect(() => {
    resizeComposer()
  }, [text])

  useEffect(() => {
    if (!other || other.isDeleted) return
    const short = shortGymName(other.name) || other.name
    const prev = document.title
    document.title = `${short} · чат · SPOTTER`
    return () => {
      document.title = prev
    }
  }, [other])

  const loadOlder = async () => {
    if (!conversationId || loadingOlder || !hasMore || !thread.length) return
    setLoadingOlder(true)
    const oldest = thread[0]?.createdAt
    const el = threadRef.current
    const prevHeight = el?.scrollHeight ?? 0
    try {
      const res = await refreshThread(conversationId, { before: oldest })
      setHasMore(Boolean(res?.hasMore))
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить историю')
    } finally {
      setLoadingOlder(false)
    }
  }

  if (hydrate === 'loading' && !conversation) {
    return (
      <main className="page chat-page" ref={pageRef}>
        <SoftLoader label="Открываем чат…" />
      </main>
    )
  }

  if ((!conversation || !other || !user) && hydrate === 'error') {
    return (
      <main className="page chat-page" ref={pageRef}>
        <div className="empty-copy-actions chat-empty-state">
          <div className="empty-copy" role="alert">
            <p className="empty-copy-title">Не удалось открыть чат</p>
            <p className="empty-copy-lead">Проверь сеть и попробуй ещё раз</p>
          </div>
          <button
            type="button"
            className="btn btn-soft btn-block"
            onClick={() => {
              setHydrate('loading')
              void refreshThread(conversationId)
                .then((res) => {
                  setHasMore(Boolean(res?.hasMore))
                  setHydrate('ready')
                  void markRead(conversationId)
                })
                .catch(() => setHydrate('error'))
            }}
          >
            Повторить
          </button>
          <Link to="/app/messages" className="btn btn-ghost btn-block">
            К списку чатов
          </Link>
        </div>
      </main>
    )
  }

  if (!conversation || !other || !user) {
    return (
      <main className="page chat-page" ref={pageRef}>
        <div className="empty-copy-actions chat-empty-state">
          <div className="empty-copy" role="status">
            <p className="empty-copy-title">Чат не найден</p>
            <p className="empty-copy-lead">Возможно, диалог удалили или ссылка устарела</p>
          </div>
          <Link to="/app/messages" className="btn btn-primary btn-block">
            К списку чатов
          </Link>
        </div>
      </main>
    )
  }

  const name = displayName(other)
  const deleted = Boolean(other.isDeleted)
  const blocked = !deleted && isBlocked(other.id)
  const contactGym = deleted ? undefined : getContactGym(other, user.gymIds)
  const gymLabel = formatGymLabel(contactGym)
  const waiting = conversation.requestStatus === 'pending'
  const incoming = conversation.requestStatus === 'incoming'
  const locked = waiting || deleted || blocked

  const dismissKeyboard = () => {
    inputRef.current?.blur()
  }

  const keepComposerFocused = () => {
    // Never blur on send — re-assert focus without scrolling the page (iOS).
    inputRef.current?.focus({ preventScroll: true })
    requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true })
      resizeComposer()
      scrollThreadToEnd()
    })
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || locked || sendingRef.current) return
    sendingRef.current = true
    setBusy(true)
    setError('')
    setText('')
    keepComposerFocused()
    try {
      await sendMessage(conversation.id, trimmed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить')
      setText(trimmed)
    } finally {
      sendingRef.current = false
      setBusy(false)
      keepComposerFocused()
    }
  }

  const onComposerKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return
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

  const onUnblock = async () => {
    setBusy(true)
    setError('')
    try {
      await unblockUser(other.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось разблокировать')
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
    if (dx < 12 && dy < 12 && document.activeElement === inputRef.current) {
      dismissKeyboard()
    }
  }

  return (
    <main className="chat-page" ref={pageRef}>
      <h1 className="sr-only">Чат с {name}</h1>
      <header className="chat-header">
        <SubpageBack
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
        />
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
        {!deleted ? <SafetyActions person={other} /> : null}
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

      {blocked ? (
        <div className="request-banner blocked-banner">
          <p>Вы заблокировали этого пользователя. История сообщений сохранена.</p>
          <button
            type="button"
            className="btn btn-soft"
            disabled={busy}
            onClick={() => void onUnblock()}
          >
            Разблокировать
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="feedback-error chat-send-error" role="alert">
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
        {hasMore ? (
          <button
            type="button"
            className="btn btn-ghost chat-load-older"
            disabled={loadingOlder}
            onClick={() => void loadOlder()}
          >
            {loadingOlder ? 'Загружаем…' : 'Ещё выше'}
          </button>
        ) : null}
        {thread.map((msg) => {
          const mine = msg.senderId === user.id || msg.senderId === 'me'
          const time = formatMsgTime(msg.createdAt)
          return (
            <div key={msg.id} className={`bubble ${mine ? 'mine' : 'theirs'}`}>
              <div className="bubble-body">
                {msg.text}
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

      {blocked ? (
        <div className="chat-input chat-input-blocked" role="status">
          <p className="muted">Нельзя писать, пока пользователь в блоке</p>
        </div>
      ) : (
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
            /* Never disable while sending — iOS blurs disabled fields and drops the keyboard */
            disabled={locked || incoming}
            maxLength={CHAT_MESSAGE_MAX}
            aria-label="Сообщение"
          />
          <button
            className="btn btn-primary"
            type="submit"
            disabled={locked || incoming || busy || !text.trim()}
            /* Keep focus on textarea so the keyboard stays open (Telegram-style) */
            onMouseDown={(e) => e.preventDefault()}
            onPointerDown={(e) => e.preventDefault()}
            aria-label="Отправить"
          >
            →
          </button>
        </form>
      )}
    </main>
  )
}
