import { type FormEvent, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../context/useApp'
import {
  FEEDBACK_CATEGORIES,
  categoryLabel,
  isTicketClosed,
  statusLabel,
  ticketsForUser,
} from '../lib/feedback'
import type { FeedbackCategoryId } from '../types'
import './FeedbackPage.css'

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
  const navigate = useNavigate()
  const { user, tickets, createFeedbackTicket, replyFeedbackTicket, refreshSupport } = useApp()
  const [view, setView] = useState<'list' | 'create'>(ticketId ? 'list' : 'list')
  const [category, setCategory] = useState<FeedbackCategoryId>('question')
  const [message, setMessage] = useState('')
  const [reply, setReply] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const mine = useMemo(
    () => (user ? ticketsForUser(user.id, tickets) : []),
    [user, tickets],
  )
  const selected = ticketId ? tickets.find((t) => t.id === ticketId) : null

  if (!user) return null

  const onCreate = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const ticket = createFeedbackTicket(category, message)
      setMessage('')
      setNotice('Обращение отправлено')
      setView('list')
      navigate(`/app/feedback/${ticket.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать')
    }
  }

  const onReply = (e: FormEvent) => {
    e.preventDefault()
    if (!selected) return
    setError('')
    try {
      replyFeedbackTicket(selected.id, reply)
      setReply('')
      setNotice('Ответ отправлен')
      refreshSupport()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось ответить')
    }
  }

  if (selected) {
    const closed = isTicketClosed(selected.status)
    return (
      <main className="page feedback-page">
        <button type="button" className="back-link" onClick={() => navigate('/app/feedback')}>
          <ArrowLeft size={18} /> К обращениям
        </button>
        <div className="feedback-ticket-card-top">
          <h1>#{selected.id.slice(-6)}</h1>
          <span className={`feedback-status ${selected.status}`}>{statusLabel(selected.status)}</span>
        </div>
        <p className="muted">
          {categoryLabel(selected.category)} · {formatWhen(selected.updatedAt)}
        </p>
        <div className="feedback-thread">
          {selected.messages.map((msg) => (
            <div key={msg.id} className={`feedback-msg feedback-msg--${msg.senderType}`}>
              <div className="feedback-msg-head">
                <strong>{msg.senderName}</strong>
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
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Ответить поддержке…"
              rows={3}
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
        <button type="button" className="back-link" onClick={() => setView('list')}>
          <ArrowLeft size={18} /> Назад
        </button>
        <h1>Новое обращение</h1>
        <p className="muted">Баг, идея или вопрос — ответим в этом же чате обращения.</p>
        <form className="feedback-actions" onSubmit={onCreate}>
          <div className="chip-grid">
            {FEEDBACK_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`chip ${category === c.id ? 'active' : ''}`}
                onClick={() => setCategory(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Опиши запрос от 10 символов"
            rows={5}
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
      <button type="button" className="back-link" onClick={() => navigate('/app/profile')}>
        <ArrowLeft size={18} /> Профиль
      </button>
      <div className="notifications-title-row">
        <h1>Обратная связь</h1>
        <button type="button" className="btn btn-primary" onClick={() => setView('create')}>
          Написать
        </button>
      </div>
      <p className="muted">Тикеты в поддержку. Можно переписываться, пока обращение открыто.</p>
      {user.isAdmin ? (
        <Link to="/app/admin" className="btn btn-soft btn-block">
          Открыть админку
        </Link>
      ) : null}
      <div className="feedback-ticket-list">
        {mine.length ? (
          mine.map((t) => (
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
          ))
        ) : (
          <div className="empty-state">Пока нет обращений. Напиши, если что-то не так.</div>
        )}
      </div>
      {notice ? <p className="feedback-notice">{notice}</p> : null}
    </main>
  )
}
