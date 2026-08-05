import { useMemo, useState } from 'react'
import { ArrowLeft, Bell, BellOff } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../context/useApp'
import {
  NOTIF_PREF_LABELS,
  isNotificationAllowed,
  typeLabel,
} from '../lib/notifications'
import './NotificationsPage.css'

function timeLabel(iso: string) {
  const date = new Date(iso)
  const diffMin = Math.round((Date.now() - date.getTime()) / 60000)
  if (diffMin < 1) return 'только что'
  if (diffMin < 60) return `${diffMin} мин`
  const hours = Math.round(diffMin / 60)
  if (hours < 24) return `${hours} ч`
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

export function NotificationsPage() {
  const navigate = useNavigate()
  const {
    notifications,
    notificationPrefs,
    unreadNotifications,
    updateNotificationPrefs,
    markNotificationRead,
    markAllNotificationsRead,
    user,
  } = useApp()
  const [tab, setTab] = useState<'feed' | 'settings'>('feed')

  const visible = useMemo(
    () =>
      notifications.filter((n) => isNotificationAllowed(notificationPrefs, n.type)),
    [notifications, notificationPrefs],
  )

  return (
    <main className="page notifications-page">
      <header className="notifications-top">
        <button type="button" className="back-link" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} /> Назад
        </button>
        <div className="notifications-title-row">
          <h1>Уведомления</h1>
          {unreadNotifications > 0 ? (
            <button
              type="button"
              className="notifications-mark-all"
              onClick={markAllNotificationsRead}
            >
              Прочитать все
            </button>
          ) : null}
        </div>
      </header>

      <div className="filter-row">
        <button
          type="button"
          className={`chip ${tab === 'feed' ? 'active' : ''}`}
          onClick={() => setTab('feed')}
        >
          Лента
        </button>
        <button
          type="button"
          className={`chip ${tab === 'settings' ? 'active' : ''}`}
          onClick={() => setTab('settings')}
        >
          Настройки
        </button>
      </div>

      {tab === 'settings' ? (
        <section className="stack">
          <button
            type="button"
            className="toggle-row master-toggle"
            onClick={() => updateNotificationPrefs({ enabled: !notificationPrefs.enabled })}
          >
            <div className="row">
              {notificationPrefs.enabled ? <Bell size={18} /> : <BellOff size={18} />}
              <div>
                <strong>{notificationPrefs.enabled ? 'Уведомления включены' : 'Уведомления выключены'}</strong>
                <p className="muted">Главный переключатель для всех типов</p>
              </div>
            </div>
            <span className={`toggle ${notificationPrefs.enabled ? 'on' : ''}`} />
          </button>

          <div className={`prefs-list ${notificationPrefs.enabled ? '' : 'dims'}`}>
            {NOTIF_PREF_LABELS.map((item) => (
              <button
                key={item.key}
                type="button"
                className="toggle-row"
                disabled={!notificationPrefs.enabled}
                onClick={() =>
                  updateNotificationPrefs({ [item.key]: !notificationPrefs[item.key] })
                }
              >
                <div>
                  <strong>{item.title}</strong>
                  <p className="muted">{item.hint}</p>
                </div>
                <span className={`toggle ${notificationPrefs[item.key] ? 'on' : ''}`} />
              </button>
            ))}
          </div>

          <Link to="/app/feedback" className="btn btn-primary btn-block">
            Обратная связь / тикеты
          </Link>
          {user?.isAdmin ? (
            <Link to="/app/admin" className="btn btn-soft btn-block">
              Админка
            </Link>
          ) : null}
        </section>
      ) : (
        <section className="card-list">
          {!notificationPrefs.enabled ? (
            <div className="empty-copy" role="status">
              <p className="empty-copy-title">Уведомления выключены</p>
              <p className="empty-copy-lead">Включи их во вкладке «Настройки»</p>
            </div>
          ) : visible.length ? (
            visible.map((item) => (
              <Link
                key={item.id}
                to={item.href || '/app/notifications'}
                className={`notification-card ${item.read ? 'is-read' : 'is-unread'}`}
                onClick={() => markNotificationRead(item.id)}
              >
                <div className="notification-card-top">
                  <span className="chip small level">{typeLabel(item.type)}</span>
                  <div className="notification-card-meta">
                    <span className="dim">{timeLabel(item.createdAt)}</span>
                    {!item.read ? (
                      <span className="notification-unread-dot" aria-label="Непрочитано" />
                    ) : null}
                  </div>
                </div>
                <strong>{item.title}</strong>
                <p className="muted">{item.body}</p>
              </Link>
            ))
          ) : (
            <div className="empty-copy" role="status">
              <p className="empty-copy-title">Пока тихо</p>
              <p className="empty-copy-lead">
                Как только в зале появится кто-то новый — напишем
              </p>
            </div>
          )}
        </section>
      )}
    </main>
  )
}
