import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../context/useApp'
import {
  categoryLabel,
  filterTicketsByTab,
  isTicketClosed,
  statusLabel,
  ticketCounts,
} from '../lib/feedback'
import { ADMIN_MESSAGE_MAX } from '../lib/fieldLimits'
import { messageFieldProps } from '../lib/inputAttrs'
import type { TicketTab } from '../types'
import './FeedbackPage.css'

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function AdminTicketsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    user,
    tickets,
    adminReplyTicket,
    adminSetTicketStatus,
    refreshSupport,
    canHandleTickets,
  } = useApp()
  const [tab, setTab] = useState<TicketTab>('incoming')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const deepTicketId = searchParams.get('ticket')
  useEffect(() => {
    void refreshSupport()
  }, [refreshSupport])
  useEffect(() => {
    if (!deepTicketId) return
    if (!tickets.some((t) => t.id === deepTicketId)) return
    setSelectedId(deepTicketId)
    setSearchParams({}, { replace: true })
  }, [deepTicketId, tickets, setSearchParams])

  const counts = ticketCounts(tickets)
  const list = useMemo(() => filterTicketsByTab(tickets, tab), [tickets, tab])
  const selected = selectedId ? tickets.find((t) => t.id === selectedId) ?? null : null

  if (!user?.isAdmin) return <Navigate to="/app/profile" replace />
  if (!canHandleTickets) return <Navigate to="/app/admin" replace />

  const run = async (fn: () => void | Promise<void>) => {
    setError('')
    try {
      await fn()
      await refreshSupport()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка')
    }
  }

  const onReply = (e: FormEvent, closeAs?: 'resolved' | 'closed') => {
    e.preventDefault()
    if (!selected) return
    void run(async () => {
      await adminReplyTicket(selected.id, reply, closeAs)
      setReply('')
      setNotice(closeAs ? 'Обращение закрыто' : 'Ответ отправлен')
      if (closeAs) {
        setSelectedId(null)
        setTab('closed')
      }
    })
  }

  if (selected) {
    const closed = isTicketClosed(selected.status)
    return (
      <main className="page admin-page">
        <button type="button" className="back-link" onClick={() => setSelectedId(null)}>
          <ArrowLeft size={18} /> К списку
        </button>
        <div className="feedback-ticket-card-top">
          <h1>#{selected.id.slice(-6)}</h1>
          <span className={`feedback-status ${selected.status}`}>{statusLabel(selected.status)}</span>
        </div>
        <p className="muted">
          {selected.userName} · {selected.userEmail} · {categoryLabel(selected.category)}
        </p>
        <div className="feedback-thread">
          {selected.messages.map((msg) => (
            <div key={msg.id} className={`feedback-msg feedback-msg--${msg.senderType}`}>
              <div className="feedback-msg-head">
                <strong>
                  {msg.senderType === 'admin' ? 'Админ' : msg.senderName}
                </strong>
                <span>{formatWhen(msg.createdAt)}</span>
              </div>
              <p>{msg.text}</p>
            </div>
          ))}
        </div>

        {closed ? (
          <p className="muted">Обращение в архиве.</p>
        ) : (
          <form className="feedback-actions" onSubmit={(e) => onReply(e)}>
            <textarea
              {...messageFieldProps}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Ответ пользователю…"
              rows={4}
              maxLength={ADMIN_MESSAGE_MAX}
            />
            <div className="btn-row">
              <button type="submit" className="btn btn-primary" disabled={reply.trim().length < 2}>
                Ответить
              </button>
              <button
                type="button"
                className="btn btn-soft"
                disabled={reply.trim().length < 2}
                onClick={(e) => onReply(e, 'resolved')}
              >
                Выполнить
              </button>
            </div>
            <div className="btn-row">
              {selected.status !== 'in_progress' ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    run(() => {
                      adminSetTicketStatus(selected.id, 'in_progress')
                      setNotice('Взято в работу')
                      setTab('in_progress')
                    })
                  }
                >
                  Взять в работу
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() =>
                  run(() => {
                    adminSetTicketStatus(selected.id, 'closed')
                    setSelectedId(null)
                    setTab('closed')
                    setNotice('Закрыто без ответа')
                  })
                }
              >
                Закрыть
              </button>
            </div>
          </form>
        )}
        {notice ? <p className="feedback-notice">{notice}</p> : null}
        {error ? <p className="feedback-error">{error}</p> : null}
      </main>
    )
  }

  return (
    <main className="page admin-page">
      <button type="button" className="back-link" onClick={() => navigate('/app/admin')}>
        <ArrowLeft size={18} /> Админка
      </button>
      <h1>Обращения</h1>
      <div className="admin-tabs">
        {(
          [
            ['incoming', `Входящие (${counts.incoming})`],
            ['in_progress', `В работе (${counts.in_progress})`],
            ['closed', `Архив (${counts.closed})`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`chip ${tab === value ? 'active' : ''}`}
            onClick={() => {
              setTab(value)
              setNotice('')
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {notice ? <p className="feedback-notice">{notice}</p> : null}
      <div className="feedback-ticket-list">
        {list.length ? (
          list.map((t) => (
            <button
              key={t.id}
              type="button"
              className="feedback-ticket-card"
              onClick={() => setSelectedId(t.id)}
            >
              <div className="feedback-ticket-card-top">
                <strong>
                  {t.userName} · {t.subject}
                </strong>
                <span className={`feedback-status ${t.status}`}>{statusLabel(t.status)}</span>
              </div>
              <span className="dim">
                {t.userEmail} · {categoryLabel(t.category)}
              </span>
              <p className="muted">{t.messages[t.messages.length - 1]?.text}</p>
              <span className="dim">{formatWhen(t.updatedAt)}</span>
            </button>
          ))
        ) : (
          <div className="empty-copy" role="status">
            <p className="empty-copy-title">Пока пусто</p>
            <p className="empty-copy-lead">В этом разделе нет обращений</p>
          </div>
        )}
      </div>
      {error ? <p className="feedback-error">{error}</p> : null}
    </main>
  )
}
