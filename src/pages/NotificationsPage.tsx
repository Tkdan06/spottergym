import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Bell, BellOff, Smartphone } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../context/useApp'
import {
  NOTIF_PREF_LABELS,
  feedNotifications,
  isNotificationAllowed,
  typeLabel,
} from '../lib/notifications'
import {
  disableWebPush,
  enableWebPush,
  getPushSubscriptionState,
  isStandalonePwa,
  pushSupported,
} from '../lib/push'
import { isWelcomeInstallNotification } from '../lib/welcomeInstall'
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

type NotifTab = 'feed' | 'settings'

function parseTab(value: string | null): NotifTab {
  return value === 'settings' ? 'settings' : 'feed'
}

export function NotificationsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    notifications,
    notificationPrefs,
    unreadNotifications,
    updateNotificationPrefs,
    markNotificationRead,
    markAllNotificationsRead,
    user,
  } = useApp()
  const tab = parseTab(searchParams.get('tab'))
  const setTab = (next: NotifTab) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        if (next === 'feed') params.delete('tab')
        else params.set('tab', next)
        return params
      },
      { replace: true },
    )
  }
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState('')
  const [prefsError, setPrefsError] = useState('')
  const [pushState, setPushState] = useState({
    supported: pushSupported(),
    standalone: isStandalonePwa(),
    permission: 'default' as NotificationPermission | 'unsupported',
    subscribed: false,
    configured: false,
  })

  const patchPrefs = (patch: Partial<typeof notificationPrefs>) => {
    setPrefsError('')
    void Promise.resolve(updateNotificationPrefs(patch)).catch((err: unknown) => {
      setPrefsError(err instanceof Error ? err.message : 'Не удалось сохранить настройки')
    })
  }

  const refreshPushState = async () => {
    const next = await getPushSubscriptionState()
    setPushState(next)
  }

  useEffect(() => {
    void refreshPushState()
  }, [tab])

  const visible = useMemo(
    () =>
      feedNotifications(notifications).filter((n) =>
        isNotificationAllowed(notificationPrefs, n.type),
      ),
    [notifications, notificationPrefs],
  )

  const pushActive = pushState.subscribed && pushState.permission === 'granted'
  const canTogglePush =
    pushState.supported && pushState.standalone && pushState.configured && pushState.permission !== 'denied'

  const onTogglePush = async () => {
    if (!canTogglePush && !pushActive) return
    setPushError('')
    setPushBusy(true)
    try {
      if (pushActive) {
        await disableWebPush()
      } else {
        await enableWebPush()
      }
      await refreshPushState()
    } catch (err) {
      setPushError(err instanceof Error ? err.message : 'Не удалось изменить пуши')
      await refreshPushState()
    } finally {
      setPushBusy(false)
    }
  }

  const pushHint = (() => {
    if (!pushState.supported) return 'Браузер не поддерживает пуши'
    if (!pushState.configured) return 'Пуши на сервере пока недоступны'
    if (pushState.permission === 'denied') return 'Разрешение выключено в системе'
    if (!pushState.standalone) return null
    if (pushActive) return 'Лайки, чаты, напоминания'
    return 'Лайки, чаты, напоминания'
  })()

  return (
    <main className="page notifications-page">
      <header className="notifications-top">
        <button
          type="button"
          className="back-link"
          onClick={() => {
            if (window.history.length > 1) navigate(-1)
            else navigate('/app')
          }}
        >
          <ArrowLeft size={18} /> Назад
        </button>
        <div className="notifications-title-row">
          <h1>Уведомления</h1>
          {unreadNotifications > 0 ? (
            <button
              type="button"
              className="notifications-mark-all"
              onClick={() => {
                void Promise.resolve(markAllNotificationsRead()).catch(() => undefined)
              }}
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
          {prefsError ? (
            <p className="feedback-error" role="alert">
              {prefsError}
            </p>
          ) : null}

          <button
            type="button"
            className="toggle-row"
            onClick={() => patchPrefs({ enabled: !notificationPrefs.enabled })}
          >
            <div className="row">
              <span className="notif-setting-icon" aria-hidden>
                {notificationPrefs.enabled ? <Bell size={20} /> : <BellOff size={20} />}
              </span>
              <div>
                <strong>{notificationPrefs.enabled ? 'Уведомления включены' : 'Уведомления выключены'}</strong>
                <p className="muted">Главный переключатель</p>
              </div>
            </div>
            <span className={`toggle ${notificationPrefs.enabled ? 'on' : ''}`} />
          </button>

          <div className="push-settings">
            <button
              type="button"
              className="toggle-row"
              disabled={pushBusy || (!canTogglePush && !pushActive)}
              onClick={() => void onTogglePush()}
            >
              <div className="row">
                <span className="notif-setting-icon" aria-hidden>
                  <Smartphone size={20} />
                </span>
                <div>
                  <strong>{pushActive ? 'Пуши включены' : 'Пуши'}</strong>
                  {pushHint ? <p className="muted">{pushHint}</p> : null}
                </div>
              </div>
              <span className={`toggle ${pushActive ? 'on' : ''}`} />
            </button>

            {!pushState.standalone && pushState.supported ? (
              <div className="empty-copy-actions push-install-cta">
                <p className="muted">
                  Пуши на телефон работают из установленного приложения (ярлык на экран Домой), не
                  из обычной вкладки Safari/Chrome.
                </p>
                <Link to="/app/install" className="btn btn-soft btn-block">
                  Как поставить на экран
                </Link>
              </div>
            ) : (
              <Link to="/app/install" className="push-guide-link">
                Как поставить ярлык на экран
              </Link>
            )}
            {pushError ? <p className="push-error">{pushError}</p> : null}
          </div>

          <div className={`prefs-list ${notificationPrefs.enabled ? '' : 'dims'}`}>
            {NOTIF_PREF_LABELS.map((item) => (
              <button
                key={item.key}
                type="button"
                className="toggle-row"
                disabled={!notificationPrefs.enabled}
                onClick={() => patchPrefs({ [item.key]: !notificationPrefs[item.key] })}
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
            <div className="empty-copy-actions">
              <div className="empty-copy" role="status">
                <p className="empty-copy-title">Уведомления выключены</p>
                <p className="empty-copy-lead">Включи их здесь — или настрой типы во вкладке «Настройки»</p>
              </div>
              {prefsError ? (
                <p className="feedback-error" role="alert">
                  {prefsError}
                </p>
              ) : null}
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={() => patchPrefs({ enabled: true })}
              >
                Включить уведомления
              </button>
              <button type="button" className="btn btn-soft btn-block" onClick={() => setTab('settings')}>
                Открыть настройки
              </button>
            </div>
          ) : visible.length ? (
            visible.map((item) => {
              const installWelcome = isWelcomeInstallNotification(item)
              return (
                <Link
                  key={item.id}
                  to={item.href || '/app/notifications'}
                  className={`notification-card ${item.read ? 'is-read' : 'is-unread'}${
                    installWelcome ? ' is-welcome-install' : ''
                  }`}
                  onClick={() => {
                    void Promise.resolve(markNotificationRead(item.id)).catch(() => undefined)
                  }}
                >
                  <div className="notification-card-top">
                    <span className="chip small level">
                      {installWelcome ? 'Совет' : typeLabel(item.type)}
                    </span>
                    <div className="notification-card-meta">
                      <span className="dim">{timeLabel(item.createdAt)}</span>
                      {!item.read ? (
                        <span className="notification-unread-dot" aria-label="Непрочитано" />
                      ) : null}
                    </div>
                  </div>
                  <strong>{item.title}</strong>
                  <p className="muted">{item.body}</p>
                  {installWelcome ? (
                    <span className="notification-card-cta">Как поставить ярлык →</span>
                  ) : null}
                </Link>
              )
            })
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
