import { type FormEvent, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowUpRight,
  Ban,
  MessageCircle,
  MessageSquare,
  Network,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from 'lucide-react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../context/useApp'
import { formatAdminDate, formatBytes } from '../lib/adminStats'
import { experienceLabel, getGym, intentLabel } from '../data/mock'
import { ADMIN_MESSAGE_MAX } from '../lib/fieldLimits'
import { messageFieldProps, searchFieldProps } from '../lib/inputAttrs'
import type { AdminDirectoryUser } from '../types'
import './FeedbackPage.css'
import './AdminPlayersPage.css'

type PlayerFilter =
  | 'real'
  | 'all'
  | 'active'
  | 'blocked'
  | 'demo'
  | 'seenToday'
  | 'checkedInToday'
  | 'sharedIp'

const FILTERS: { id: PlayerFilter; label: string }[] = [
  { id: 'real', label: 'Пользователи' },
  { id: 'seenToday', label: 'Заходили сегодня' },
  { id: 'checkedInToday', label: 'В зале сегодня' },
  { id: 'sharedIp', label: 'Один IP' },
  { id: 'active', label: 'Сейчас в зале' },
  { id: 'blocked', label: 'Блок' },
  { id: 'demo', label: 'Сиды' },
  { id: 'all', label: 'Все' },
]

function parseFilter(raw: string | null): PlayerFilter {
  if (
    raw === 'seenToday' ||
    raw === 'checkedInToday' ||
    raw === 'sharedIp' ||
    raw === 'active' ||
    raw === 'blocked' ||
    raw === 'demo' ||
    raw === 'all' ||
    raw === 'real'
  ) {
    return raw
  }
  return 'real'
}

function gymLabel(gymId?: string) {
  if (!gymId) return '—'
  const gym = getGym(gymId)
  if (!gym) return gymId
  return `${gym.network} · ${gym.name.replace(/^World Class\s+/i, '').replace(/^DDX\s+/i, '')}`
}

export function AdminPlayersPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    user,
    blockedEmails,
    blockedIps,
    canViewUsers,
    canBlockUsers,
    canMessageUsers,
    canRemoveUsers,
    adminDirectory,
    adminBlockEmail,
    adminUnblockEmail,
    adminBlockIp,
    adminUnblockIp,
    adminRemoveUser,
    adminMessageUser,
    refreshAdminDirectory,
    startConversation,
  } = useApp()

  const [query, setQuery] = useState(() => searchParams.get('q')?.trim() || '')
  const filter = parseFilter(searchParams.get('filter'))
  const [activityList, setActivityList] = useState<AdminDirectoryUser[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const fromUrl = searchParams.get('q')?.trim() || ''
    if (fromUrl) setQuery(fromUrl)
  }, [searchParams])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const setFilter = (next: PlayerFilter) => {
    const sp = new URLSearchParams(searchParams)
    if (next === 'real') sp.delete('filter')
    else sp.set('filter', next)
    setSearchParams(sp, { replace: true })
  }

  useEffect(() => {
    if (filter !== 'seenToday' && filter !== 'checkedInToday') {
      setActivityList(null)
      return
    }
    let cancelled = false
    setBusy(true)
    setError('')
    void refreshAdminDirectory({ activity: filter })
      .then((rows) => {
        if (!cancelled) setActivityList(rows)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Ошибка загрузки')
          setActivityList([])
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false)
      })
    return () => {
      cancelled = true
    }
  }, [filter, refreshAdminDirectory])

  const players = useMemo(() => {
    const source =
      filter === 'seenToday' || filter === 'checkedInToday'
        ? activityList || []
        : adminDirectory
    return [...source].sort((a, b) => {
      if (filter === 'seenToday') {
        const at = a.lastSeenAt ? +new Date(a.lastSeenAt) : 0
        const bt = b.lastSeenAt ? +new Date(b.lastSeenAt) : 0
        return bt - at || a.name.localeCompare(b.name, 'ru')
      }
      if (filter === 'checkedInToday') {
        const at = a.checkedInTodayAt ? +new Date(a.checkedInTodayAt) : 0
        const bt = b.checkedInTodayAt ? +new Date(b.checkedInTodayAt) : 0
        return bt - at || a.name.localeCompare(b.name, 'ru')
      }
      const ar = a.isDemoSeed ? 1 : 0
      const br = b.isDemoSeed ? 1 : 0
      if (ar !== br) return ar - br
      const at = a.registeredAt ? +new Date(a.registeredAt) : 0
      const bt = b.registeredAt ? +new Date(b.registeredAt) : 0
      return bt - at || a.name.localeCompare(b.name, 'ru')
    })
  }, [adminDirectory, activityList, filter])

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return players.filter((p) => {
      if (filter === 'real' && p.isDemoSeed) return false
      if (filter === 'demo' && !p.isDemoSeed) return false
      if (filter === 'active' && !p.isActive) return false
      if (filter === 'sharedIp' && (p.signupIpCount || 0) < 2) return false
      if (filter === 'blocked' && !blockedEmails.includes(p.email.toLowerCase())) return false
      if (!q) return true
      const hay = [
        p.name,
        p.email,
        p.city,
        p.homeGymId,
        p.signupIp,
        ...(p.gymIds || []),
        String(p.age || ''),
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [players, query, filter, blockedEmails])

  const selected =
    players.find((p) => p.id === selectedId || p.email === selectedId) || null

  if (!user?.isAdmin) return <Navigate to="/app/profile" replace />
  if (!canViewUsers) return <Navigate to="/app/admin" replace />

  const refresh = () => {
    setBusy(true)
    setError('')
    const opts =
      filter === 'seenToday' || filter === 'checkedInToday'
        ? { activity: filter as 'seenToday' | 'checkedInToday' }
        : undefined
    void Promise.resolve(refreshAdminDirectory(opts))
      .then((rows) => {
        if (opts) setActivityList(rows)
        setNotice('Список обновлён с сервера')
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Ошибка обновления'))
      .finally(() => setBusy(false))
  }

  const onBlockToggle = (entry: AdminDirectoryUser) => {
    setError('')
    setNotice('')
    void (async () => {
      try {
        if (entry.isMasterAdmin) throw new Error('Нельзя блокировать главного админа')
        const blocked = blockedEmails.includes(entry.email.toLowerCase())
        if (blocked) {
          await adminUnblockEmail(entry.email)
          setNotice(`${entry.email} разблокирован`)
        } else {
          await adminBlockEmail(entry.email)
          setNotice(`${entry.email} заблокирован`)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка')
      }
    })()
  }

  const onIpBlockToggle = (entry: AdminDirectoryUser) => {
    setError('')
    setNotice('')
    const ip = entry.signupIp?.trim()
    if (!ip || ip === 'unknown') {
      setError('IP регистрации неизвестен')
      return
    }
    void (async () => {
      try {
        const blocked = blockedIps.includes(ip.toLowerCase())
        if (blocked) {
          await adminUnblockIp(ip)
          setNotice(`IP ${ip} разблокирован`)
          return
        }
        const ok = window.confirm(
          `Заблокировать IP ${ip}?\n\nС этой сети нельзя будет войти, зарегистрироваться или пользоваться API. Осторожно: общий Wi‑Fi зала заблокирует и других.`,
        )
        if (!ok) return
        await adminBlockIp(ip)
        setNotice(`IP ${ip} заблокирован`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка')
      }
    })()
  }

  const onSend = async (e: FormEvent) => {
    e.preventDefault()
    if (!selected) return
    setError('')
    setNotice('')
    try {
      await adminMessageUser(selected, message)
      setMessage('')
      setNotice('Сообщение отправлено')
      navigate(`/app/admin/tickets`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка')
    }
  }

  const onOpenProfile = (entry: AdminDirectoryUser) => {
    navigate(`/app/user/${entry.id}`, {
      state: { from: '/app/admin/players' },
    })
  }

  const onOpenChat = (entry: AdminDirectoryUser) => {
    if (!user || entry.isDemoSeed) return
    if (entry.id === user.id) {
      setError('Нельзя написать себе')
      return
    }
    setError('')
    setNotice('')
    setBusy(true)
    void Promise.resolve(startConversation(entry.id, ''))
      .then((id: string) => {
        navigate(`/app/messages/${id}`, { state: { from: '/app/admin/players' } })
      })
      .catch((err: unknown) => {
        const cid =
          err && typeof err === 'object' && 'conversationId' in err
            ? (err as { conversationId?: string }).conversationId
            : undefined
        if (typeof cid === 'string' && cid) {
          navigate(`/app/messages/${cid}`, { state: { from: '/app/admin/players' } })
          return
        }
        setError(err instanceof Error ? err.message : 'Не удалось открыть чат')
      })
      .finally(() => setBusy(false))
  }

  const onRemove = (entry: AdminDirectoryUser) => {
    setError('')
    setNotice('')
    const ok = window.confirm(
      `Удалить аккаунт ${entry.email}?\n\nПрофиль исчезнет из зала и поиска. Переписки с ним сохранятся у собеседников как «Удалённый пользователь».`,
    )
    if (!ok) return
    const alsoBlock = window.confirm(
      'Также заблокировать этот email (не сможет зарегистрироваться снова)?',
    )
    setBusy(true)
    void (async () => {
      try {
        await adminRemoveUser(entry.email, alsoBlock)
        setSelectedId(null)
        setNotice(
          alsoBlock ? `${entry.email} удалён и заблокирован` : `${entry.email} удалён`,
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось удалить')
      } finally {
        setBusy(false)
      }
    })()
  }

  const subtitle =
    filter === 'seenToday'
      ? 'Заходили в приложение сегодня (МСК) · lastSeen'
      : filter === 'checkedInToday'
        ? 'Нажали «Я в зале» сегодня (МСК)'
        : `Реестр с сервера · ${adminDirectory.filter((p) => !p.isDemoSeed).length} аккаунтов`

  return (
    <main className="page admin-page admin-players-page">
      <button type="button" className="back-link" onClick={() => navigate('/app/admin')}>
        <ArrowLeft size={18} /> Админка
      </button>

      <header className="admin-players-head">
        <div>
          <h1>Пользователи</h1>
          <p className="muted">{subtitle}</p>
        </div>
        <button
          type="button"
          className="btn-icon-refresh"
          onClick={refresh}
          aria-label="Обновить"
          title="Обновить"
          disabled={busy}
        >
          <RefreshCw size={22} strokeWidth={2.4} />
        </button>
      </header>

      <p className="dim">
        DAU считает любой вход в аккаунт. Чекин «в зале» — отдельно. Города — в{' '}
        <Link to="/app/admin/analytics" className="text-link">
          Аналитике
        </Link>
        .
      </p>

      <div className="admin-players-toolbar">
        <input
          {...searchFieldProps}
          className="search-input"
          placeholder="Поиск: имя, email, город, зал, IP"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="admin-filter-bar" role="tablist" aria-label="Фильтр пользователей">
          {FILTERS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={filter === id}
              className={`admin-filter-btn ${filter === id ? 'is-active' : ''}`}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="muted admin-players-count">
        Найдено: {list.length}
        {busy && (filter === 'seenToday' || filter === 'checkedInToday')
          ? ' · загружаем…'
          : ''}
      </p>

      <div className="admin-players-layout">
        <div className="admin-players-list">
          {list.map((entry) => {
            const blocked = blockedEmails.includes(entry.email.toLowerCase())
            const sharedIp = (entry.signupIpCount || 0) >= 2
            return (
              <button
                key={`${entry.id}-${entry.email}`}
                type="button"
                className={`admin-player-row ${selected?.email === entry.email ? 'is-selected' : ''} ${blocked ? 'is-blocked' : ''} ${sharedIp ? 'is-shared-ip' : ''}`}
                onClick={() => setSelectedId(entry.email)}
              >
                <div className="admin-player-row-top">
                  <strong>
                    {entry.name}
                    {entry.isMasterAdmin ? ' · главный' : entry.isAdmin ? ' · админ' : ''}
                    {entry.isDemoSeed ? ' · сид' : ''}
                  </strong>
                  <span className="admin-player-row-flags">
                    {sharedIp ? (
                      <span className="admin-ip-flag" title={entry.signupIp || ''}>
                        IP ×{entry.signupIpCount}
                      </span>
                    ) : null}
                    {entry.isActive ? <span className="mock-online">в зале</span> : null}
                  </span>
                </div>
                <p className="muted">{entry.email}</p>
                <div className="admin-player-meta">
                  <span>{entry.age ? `${entry.age} лет` : 'возраст —'}</span>
                  <span>{entry.city || 'город —'}</span>
                  <span>{gymLabel(entry.homeGymId || entry.gymIds?.[0])}</span>
                </div>
                {filter === 'seenToday' ? (
                  <p className="dim">Визит {formatAdminDate(entry.lastSeenAt)}</p>
                ) : filter === 'checkedInToday' ? (
                  <p className="dim">
                    Чекин {formatAdminDate(entry.checkedInTodayAt)} ·{' '}
                    {gymLabel(entry.checkedInTodayGymId)}
                  </p>
                ) : (
                  <p className="dim">
                    Рег. {formatAdminDate(entry.registeredAt)}
                    {entry.lastSeenAt
                      ? ` · визит ${formatAdminDate(entry.lastSeenAt)}`
                      : ''}
                  </p>
                )}
              </button>
            )
          })}
          {!list.length ? <p className="muted">Никого не найдено</p> : null}
        </div>

        <aside className="admin-player-detail surface">
          {selected ? (
            <>
              <h2>{selected.name}</h2>
              <p className="muted">{selected.email}</p>
              <dl className="admin-detail-grid">
                <div>
                  <dt>Регистрация</dt>
                  <dd>{formatAdminDate(selected.registeredAt)}</dd>
                </div>
                <div>
                  <dt>IP регистрации</dt>
                  <dd
                    className={
                      (selected.signupIpCount || 0) >= 2 ||
                      (selected.signupIp &&
                        blockedIps.includes(selected.signupIp.toLowerCase()))
                        ? 'admin-detail-ip-warn'
                        : undefined
                    }
                  >
                    {selected.signupIp && selected.signupIp !== 'unknown'
                      ? selected.signupIp
                      : '—'}
                    {(selected.signupIpCount || 0) >= 2
                      ? ` · ещё ${(selected.signupIpCount || 0) - 1} с этим IP`
                      : ''}
                    {selected.signupIp &&
                    blockedIps.includes(selected.signupIp.toLowerCase())
                      ? ' · забанен'
                      : ''}
                  </dd>
                </div>
                <div>
                  <dt>Последний визит</dt>
                  <dd>{formatAdminDate(selected.lastSeenAt)}</dd>
                </div>
                <div>
                  <dt>Чекин сегодня</dt>
                  <dd>
                    {selected.checkedInTodayAt
                      ? `${formatAdminDate(selected.checkedInTodayAt)} · ${gymLabel(selected.checkedInTodayGymId)}`
                      : 'нет'}
                  </dd>
                </div>
                <div>
                  <dt>Возраст / пол</dt>
                  <dd>
                    {selected.age ?? '—'} ·{' '}
                    {selected.gender === 'female'
                      ? 'жен'
                      : selected.gender === 'male'
                        ? 'муж'
                        : '—'}
                  </dd>
                </div>
                <div>
                  <dt>Город</dt>
                  <dd>{selected.city || '—'}</dd>
                </div>
                <div>
                  <dt>Домашний зал</dt>
                  <dd>{gymLabel(selected.homeGymId)}</dd>
                </div>
                <div>
                  <dt>Все залы</dt>
                  <dd>
                    {(selected.gymIds || []).length
                      ? (selected.gymIds || []).map((id) => gymLabel(id)).join('; ')
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt>Цель / уровень</dt>
                  <dd>
                    {selected.intent ? intentLabel(selected.intent) : '—'} ·{' '}
                    {selected.experienceLevel
                      ? experienceLabel(selected.experienceLevel)
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt>Онбординг</dt>
                  <dd>{selected.onboardingDone ? 'завершён' : 'не завершён'}</dd>
                </div>
                <div>
                  <dt>Сейчас</dt>
                  <dd>
                    {selected.isActive
                      ? `в зале · ${gymLabel(selected.checkedInGymId || selected.homeGymId)}`
                      : 'не в зале'}
                  </dd>
                </div>
                <div>
                  <dt>Фото</dt>
                  <dd>
                    {selected.photosCount || 0} шт · {formatBytes(selected.photosBytes || 0)}
                  </dd>
                </div>
                <div>
                  <dt>Тренер</dt>
                  <dd>{selected.isCoach ? 'да' : 'нет'}</dd>
                </div>
                <div>
                  <dt>Статус</dt>
                  <dd>
                    {blockedEmails.includes(selected.email.toLowerCase())
                      ? 'заблокирован'
                      : selected.isDemoSeed
                        ? 'демо-сид'
                        : 'активен'}
                  </dd>
                </div>
              </dl>

              <div className="admin-player-actions" role="toolbar" aria-label="Действия">
                <button
                  type="button"
                  className="admin-action-icon"
                  onClick={() => onOpenProfile(selected)}
                  title="Открыть профиль"
                  aria-label="Открыть профиль"
                >
                  <ArrowUpRight size={18} />
                </button>
                {!selected.isDemoSeed && selected.id !== user?.id ? (
                  <button
                    type="button"
                    className="admin-action-icon"
                    onClick={() => onOpenChat(selected)}
                    disabled={busy}
                    title="Написать в чат"
                    aria-label="Написать в чат"
                  >
                    <MessageCircle size={18} />
                  </button>
                ) : null}
                {canBlockUsers ? (
                  <button
                    type="button"
                    className="admin-action-icon"
                    onClick={() => onBlockToggle(selected)}
                    disabled={busy || selected.isMasterAdmin}
                    title={
                      blockedEmails.includes(selected.email.toLowerCase())
                        ? 'Разблокировать email'
                        : 'Заблокировать email'
                    }
                    aria-label={
                      blockedEmails.includes(selected.email.toLowerCase())
                        ? 'Разблокировать email'
                        : 'Заблокировать email'
                    }
                  >
                    <Ban size={18} />
                  </button>
                ) : null}
                {canBlockUsers &&
                selected.signupIp &&
                selected.signupIp !== 'unknown' ? (
                  <button
                    type="button"
                    className="admin-action-icon"
                    onClick={() => onIpBlockToggle(selected)}
                    disabled={busy}
                    title={
                      blockedIps.includes(selected.signupIp.toLowerCase())
                        ? 'Разблокировать IP'
                        : 'Заблокировать IP'
                    }
                    aria-label={
                      blockedIps.includes(selected.signupIp.toLowerCase())
                        ? 'Разблокировать IP'
                        : 'Заблокировать IP'
                    }
                  >
                    <Network size={18} />
                  </button>
                ) : null}
                {canRemoveUsers && !selected.isDemoSeed && !selected.isMasterAdmin ? (
                  <button
                    type="button"
                    className="admin-action-icon danger"
                    onClick={() => onRemove(selected)}
                    disabled={busy}
                    title="Удалить аккаунт"
                    aria-label="Удалить аккаунт"
                  >
                    <Trash2 size={18} />
                  </button>
                ) : null}
                <Link
                  to="/app/admin/users"
                  className="admin-action-icon"
                  title="Права админа"
                  aria-label="Права админа"
                >
                  <ShieldAlert size={18} />
                </Link>
              </div>

              {!selected.isDemoSeed && canMessageUsers ? (
                <form className="admin-message-form" onSubmit={onSend}>
                  <h3>
                    <MessageSquare size={16} /> Тикет поддержки
                  </h3>
                  <p className="muted">
                    Служба поддержки: создаст обращение. Для личного чата от своего имени — иконка
                    сообщения выше.
                  </p>
                  <textarea
                    {...messageFieldProps}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Текст сообщения (от 2 символов)"
                    rows={4}
                    required
                    maxLength={ADMIN_MESSAGE_MAX}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={message.trim().length < 2}
                  >
                    Отправить
                  </button>
                </form>
              ) : null}
              {!selected.isDemoSeed && !canMessageUsers ? (
                <p className="muted">Нет права писать пользователям.</p>
              ) : null}
              {selected.isDemoSeed ? (
                <p className="muted">Демо-сиды — только для витрины демо-аккаунта.</p>
              ) : null}
            </>
          ) : (
            <p className="muted">
              Выбери пользователя слева: профиль, чат, блок или тикет поддержки.
            </p>
          )}
        </aside>
      </div>

      {notice ? <p className="feedback-notice">{notice}</p> : null}
      {error ? <p className="feedback-error">{error}</p> : null}
    </main>
  )
}
