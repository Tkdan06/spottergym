import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { SubpageHeader } from '../components/SubpageHeader'
import { useApp } from '../context/useApp'
import {
  FEEDBACK_CATEGORIES,
  categoryLabel,
  isTicketClosed,
  statusLabel,
  ticketsForUser,
} from '../lib/feedback'
import { FEEDBACK_MESSAGE_MAX } from '../lib/fieldLimits'
import { messageFieldProps } from '../lib/inputAttrs'
import { useKeyboardInset } from '../lib/useKeyboardInset'
import type { FeedbackCategoryId } from '../types'
import './FeedbackPage.css'

const GYM_REQUEST_TEMPLATE = `Заявка на добавление зала

Город: 
Название: 
Адрес: `

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function FeedbackPage() {
  const { ticketId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, tickets, createFeedbackTicket, replyFeedbackTicket, refreshSupport } = useApp()
  const [view, setView] = useState<'list' | 'create'>(ticketId ? 'list' : 'list')
  const [category, setCategory] = useState<FeedbackCategoryId>('question')
  const [message, setMessage] = useState('')
  const [reply, setReply] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useKeyboardInset('--form-keyboard')

  useEffect(() => {
    if (ticketId || searchParams.get('topic') !== 'gym') return
    const city = user?.city ? `${user.city}` : ''
    setView('create')
    setCategory('suggestion')
    setMessage(
      `Заявка на добавление зала\n\nГород: ${city}\nНазвание: \nАдрес: `,
    )
  }, [ticketId, searchParams, user?.city])

  const mine = useMemo(
    () => (user ? ticketsForUser(user.id, tickets) : []),
    [user, tickets],
  )
  const selected = ticketId ? tickets.find((t) => t.id === ticketId) : null

  if (!user) return null

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const ticket = await createFeedbackTicket(category, message)
      setMessage('')
      setNotice('Обращение отправлено')
      setView('list')
      navigate(`/app/feedback/${ticket.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать')
    }
  }

  const onReply = async (e: FormEvent) => {
    e.preventDefault()
    if (!selected) return
    setError('')
    try {
      await replyFeedbackTicket(selected.id, reply)
      setReply('')
      setNotice('Ответ отправлен')
      await refreshSupport()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось ответить')
    }
  }

  if (selected) {
    const closed = isTicketClosed(selected.status)
    return (
      <main className="page feedback-page">
        <SubpageHeader
          title={`#${selected.id.slice(-6)}`}
          onBack={() => navigate('/app/feedback')}
          action={
            <span className={`feedback-status ${selected.status}`}>{statusLabel(selected.status)}</span>
          }
        />
        <p className="muted">
          {categoryLabel(selected.category)} · {formatWhen(selected.updatedAt)}
        </p>
        <div className="feedback-thread">
          {selected.messages.map((msg) => (
            <div key={msg.id} className={`feedback-msg feedback-msg--${msg.senderType}`}>
              <div className="feedback-msg-head">
                <strong>{msg.senderType === 'admin' ? 'Админ' : msg.senderName}</strong>
                <span>{formatWhen(msg.createdAt)}</span>
              </div>
              <p>{msg.text}</p>
            </div>
          ))}
        </div>
        {closed ? (
          <p className="muted">Обращение закрыто — новые ответы недоступны.</p>
        ) : (
          <form className="feedback-actions" onSubmit={onReply}>
            <textarea
              {...messageFieldProps}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Ответить поддержке…"
              rows={3}
              maxLength={FEEDBACK_MESSAGE_MAX}
            />
            <button type="submit" className="btn btn-primary btn-block" disabled={reply.trim().length < 2}>
              Отправить
            </button>
          </form>
        )}
        {notice ? <p className="feedback-notice">{notice}</p> : null}
        {error ? <p className="feedback-error">{error}</p> : null}
      </main>
    )
  }

  if (view === 'create') {
    return (
      <main className="page feedback-page">
        <SubpageHeader title="Новое обращение" onBack={() => setView('list')} />
        <p className="muted feedback-lead">
          {category === 'suggestion' && message.startsWith('Заявка на добавление зала')
            ? 'Заполни название и адрес — добавим клуб в каталог.'
            : 'Баг, идея или вопрос — ответим в этом же чате обращения.'}
        </p>
        <form className="feedback-actions" onSubmit={onCreate}>
          <div className="chip-grid">
            {FEEDBACK_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`chip ${category === c.id ? 'active' : ''}`}
                onClick={() => {
                  setCategory(c.id)
                  if (c.id === 'suggestion' && !message.trim()) {
                    setMessage(GYM_REQUEST_TEMPLATE)
                  }
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
          <textarea
            {...messageFieldProps}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Опиши запрос от 10 символов"
            rows={5}
            maxLength={FEEDBACK_MESSAGE_MAX}
          />
          <button type="submit" className="btn btn-primary btn-block">
            Отправить
          </button>
        </form>
        {error ? <p className="feedback-error">{error}</p> : null}
      </main>
    )
  }

  return (
    <main className="page feedback-page">
      <SubpageHeader title="Обратная связь" onBack={() => navigate('/app/profile')} />
      <p className="muted feedback-lead">Баг, идея или вопрос — ответим здесь</p>

      {user.isAdmin ? (
        <Link to="/app/admin" className="btn btn-soft btn-block">
          Открыть админку
        </Link>
      ) : null}

      {mine.length ? (
        <>
          <div className="feedback-ticket-list">
            {mine.map((t) => (
              <button
                key={t.id}
                type="button"
                className="feedback-ticket-card"
                onClick={() => navigate(`/app/feedback/${t.id}`)}
              >
                <div className="feedback-ticket-card-top">
                  <strong>{t.subject}</strong>
                  <span className={`feedback-status ${t.status}`}>{statusLabel(t.status)}</span>
                </div>
                <span className="dim">{categoryLabel(t.category)}</span>
                <p className="muted">{t.messages[t.messages.length - 1]?.text}</p>
                <span className="dim">{formatWhen(t.updatedAt)}</span>
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-primary btn-block" onClick={() => setView('create')}>
            Написать
          </button>
        </>
      ) : (
        <div className="empty-copy-actions">
          <div className="empty-copy" role="status">
            <p className="empty-copy-title">Пока нет обращений</p>
            <p className="empty-copy-lead">Напиши, если что-то не так</p>
          </div>
          <button type="button" className="btn btn-primary btn-block" onClick={() => setView('create')}>
            Написать
          </button>
        </div>
      )}

      {notice ? <p className="feedback-notice">{notice}</p> : null}
    </main>
  )
}
