import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Megaphone, RefreshCw } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { SectionTitle } from '../components/SectionTitle'
import { useApp } from '../context/useApp'
import {
  apiAdminCreateBroadcast,
  apiAdminFetchBroadcasts,
  type AdminBroadcast,
} from '../lib/apiClient'
import { formatAdminDate } from '../lib/adminStats'
import './FeedbackPage.css'
import './AdminPlayersPage.css'

export function AdminBroadcastsPage() {
  const navigate = useNavigate()
  const { user, canMessageUsers } = useApp()
  const [list, setList] = useState<AdminBroadcast[]>([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  const load = useCallback(async () => {
    if (!canMessageUsers) return
    setLoading(true)
    setError('')
    try {
      setList(await apiAdminFetchBroadcasts())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить рассылки')
      setList([])
    } finally {
      setLoading(false)
    }
  }, [canMessageUsers])

  useEffect(() => {
    void load()
  }, [load])

  if (!user?.isAdmin) return <Navigate to="/app/profile" replace />
  if (!canMessageUsers) return <Navigate to="/app/admin" replace />

  const onSend = async () => {
    if (sending) return
    const t = title.trim()
    const b = body.trim()
    if (!t || !b) {
      setError('Укажи заголовок и текст')
      return
    }
    const confirmed = window.confirm(
      `Отправить всем пользователям?\n\n«${t}»\n\nСообщение появится в колокольчике у каждого.`,
    )
    if (!confirmed) return

    setSending(true)
    setError('')
    setOk('')
    try {
      const created = await apiAdminCreateBroadcast(t, b)
      setTitle('')
      setBody('')
      setOk(
        `Отправлено ${created.recipientCount} пользователям · прочитано пока ${created.readCount}`,
      )
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить')
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="page admin-page">
      <button type="button" className="back-link" onClick={() => navigate('/app/admin')}>
        <ArrowLeft size={18} /> Админка
      </button>

      <header className="admin-players-head">
        <div>
          <h1 className="page-title">Рассылка</h1>
          <p className="muted">Сообщение всем в колокольчик · доставка и прочтения</p>
        </div>
        <button
          type="button"
          className="btn-icon-refresh"
          onClick={() => void load()}
          aria-label="Обновить"
          title="Обновить"
          disabled={loading || sending}
        >
          <RefreshCw size={22} strokeWidth={2.4} />
        </button>
      </header>

      {error ? (
        <p className="feedback-error" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="dim" role="status">
          {ok}
        </p>
      ) : null}

      <section className="surface" style={{ display: 'grid', gap: 12, padding: 16 }}>
        <SectionTitle>Новое сообщение</SectionTitle>
        <label className="field">
          <span>Заголовок</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="Например: Обновление Spotter"
            disabled={sending}
          />
        </label>
        <label className="field">
          <span>Текст</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={500}
            rows={5}
            placeholder="Коротко и по делу — увидят все пользователи"
            disabled={sending}
          />
        </label>
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={sending || !title.trim() || !body.trim()}
          onClick={() => void onSend()}
        >
          <Megaphone size={16} /> {sending ? 'Отправляем…' : 'Отправить всем'}
        </button>
        <p className="dim" style={{ margin: 0 }}>
          Уйдёт в колокольчик и пуш (если включён). Лимит — до 10 рассылок в час.
        </p>
      </section>

      <section className="surface" style={{ display: 'grid', gap: 12, padding: 16 }}>
        <SectionTitle>История</SectionTitle>
        {loading && !list.length ? <p className="muted">Загружаем…</p> : null}
        {!loading && !list.length ? (
          <p className="muted">Пока нет рассылок</p>
        ) : (
          <ul className="workouts-list" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
            {list.map((item) => {
              const readPct =
                item.recipientCount > 0
                  ? Math.round((item.readCount / item.recipientCount) * 100)
                  : 0
              return (
                <li key={item.id} className="admin-broadcast-row">
                  <div className="workouts-row-copy" style={{ display: 'grid', gap: 4 }}>
                    <strong>{item.title}</strong>
                    <span className="muted" style={{ whiteSpace: 'pre-wrap' }}>
                      {item.body}
                    </span>
                    <span className="dim">
                      {formatAdminDate(item.createdAt)} · {item.createdByName}
                    </span>
                  </div>
                  <div className="admin-stat-grid" style={{ marginTop: 10 }}>
                    <article className="admin-stat-card">
                      <span className="muted">Доставлено</span>
                      <strong>{item.recipientCount}</strong>
                    </article>
                    <article className="admin-stat-card">
                      <span className="muted">Прочитали</span>
                      <strong>
                        {item.readCount}{' '}
                        <span className="dim" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                          · {readPct}%
                        </span>
                      </strong>
                    </article>
                    <article className="admin-stat-card">
                      <span className="muted">Не прочитали</span>
                      <strong>{item.unreadCount}</strong>
                    </article>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <Link to="/app/notifications" className="btn btn-soft btn-block">
        Открыть колокольчик
      </Link>
    </main>
  )
}
