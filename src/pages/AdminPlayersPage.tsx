import { type FormEvent, useMemo, useState } from 'react'
import { ArrowLeft, Ban, MessageSquare, RefreshCw, ShieldAlert, Trash2 } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useApp } from '../context/useApp'
import { formatAdminDate, formatBytes } from '../lib/adminStats'
import { experienceLabel, getGym, intentLabel } from '../data/mock'
import { ADMIN_MESSAGE_MAX } from '../lib/fieldLimits'
import { messageFieldProps, searchFieldProps } from '../lib/inputAttrs'
import type { AdminDirectoryUser } from '../types'
import './FeedbackPage.css'
import './AdminPlayersPage.css'

function gymLabel(gymId?: string) {
  if (!gymId) return '—'
  const gym = getGym(gymId)
  if (!gym) return gymId
  return `${gym.network} · ${gym.name.replace(/^World Class\s+/i, '').replace(/^DDX\s+/i, '')}`
}

export function AdminPlayersPage() {
  const navigate = useNavigate()
  const {
    user,
    blockedEmails,
    canViewUsers,
    canBlockUsers,
    canMessageUsers,
    canRemoveUsers,
    adminDirectory,
    adminBlockEmail,
    adminUnblockEmail,
    adminRemoveUser,
    adminMessageUser,
    refreshAdminDirectory,
  } = useApp()

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'real' | 'all' | 'active' | 'blocked' | 'demo'>('real')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const players = useMemo(() => {
    return [...adminDirectory].sort((a, b) => {
      const ar = a.isDemoSeed ? 1 : 0
      const br = b.isDemoSeed ? 1 : 0
      if (ar !== br) return ar - br
      const at = a.registeredAt ? +new Date(a.registeredAt) : 0
      const bt = b.registeredAt ? +new Date(b.registeredAt) : 0
      return bt - at || a.name.localeCompare(b.name, 'ru')
    })
  }, [adminDirectory])

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return players.filter((p) => {
      if (filter === 'real' && p.isDemoSeed) return false
      if (filter === 'demo' && !p.isDemoSeed) return false
      if (filter === 'active' && !p.isActive) return false
      if (filter === 'blocked' && !blockedEmails.includes(p.email.toLowerCase())) return false
      if (!q) return true
      const hay = [
        p.name,
        p.email,
        p.city,
        p.homeGymId,
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
    void Promise.resolve(refreshAdminDirectory())
      .then(() => setNotice('Список обновлён с сервера'))
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

  const onRemove = (entry: AdminDirectoryUser) => {
    setError('')
    setNotice('')
    const ok = window.confirm(
      `Удалить аккаунт ${entry.email}?\n\nПрофиль исчезнет из зала и поиска. Переписки с ним сохранятся у собеседников как «Удалённый пользователь».`,
    )
    if (!ok) return
    const alsoBlock = window.confirm('Также заблокировать этот email (не сможет зарегистрироваться снова)?')
    setBusy(true)
    void (async () => {
      try {
        await adminRemoveUser(entry.email, alsoBlock)
        setSelectedId(null)
        setNotice(
          alsoBlock
            ? `${entry.email} удалён и заблокирован`
            : `${entry.email} удалён`,
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось удалить')
      } finally {
        setBusy(false)
      }
    })()
  }

  return (
    <main className="page admin-page admin-players-page">
      <button type="button" className="back-link" onClick={() => navigate('/app/admin')}>
        <ArrowLeft size={18} /> Админка
      </button>

      <header className="admin-players-head">
        <div>
          <h1>Пользователи</h1>
          <p className="muted">
            Реестр с сервера · {players.filter((p) => !p.isDemoSeed).length} аккаунтов
          </p>
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
        Города, залы и DAU/MAU — в{' '}
        <Link to="/app/admin/analytics" className="text-link">
          Аналитике
        </Link>
        .
      </p>

      <div className="admin-players-toolbar">
        <input
          {...searchFieldProps}
          className="search-input"
          placeholder="Поиск: имя, email, город, зал, возраст"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="admin-filter-bar" role="tablist" aria-label="Фильтр пользователей">
          {(
            [
              ['real', 'Пользователи'],
              ['active', 'В зале'],
              ['blocked', 'Блок'],
              ['demo', 'Сиды'],
              ['all', 'Все'],
            ] as const
          ).map(([id, label]) => (
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

      <p className="muted admin-players-count">Найдено: {list.length}</p>

      <div className="admin-players-layout">
        <div className="admin-players-list">
          {list.map((entry) => {
            const blocked = blockedEmails.includes(entry.email.toLowerCase())
            return (
              <button
                key={`${entry.id}-${entry.email}`}
                type="button"
                className={`admin-player-row ${selected?.email === entry.email ? 'is-selected' : ''} ${blocked ? 'is-blocked' : ''}`}
                onClick={() => setSelectedId(entry.email)}
              >
                <div className="admin-player-row-top">
                  <strong>
                    {entry.name}
                    {entry.isMasterAdmin ? ' · главный' : entry.isAdmin ? ' · админ' : ''}
                    {entry.isDemoSeed ? ' · сид' : ''}
                  </strong>
                  {entry.isActive ? <span className="mock-online">в зале</span> : null}
                </div>
                <p className="muted">{entry.email}</p>
                <div className="admin-player-meta">
                  <span>{entry.age ? `${entry.age} лет` : 'возраст —'}</span>
                  <span>{entry.city || 'город —'}</span>
                  <span>{gymLabel(entry.homeGymId || entry.gymIds?.[0])}</span>
                </div>
                <p className="dim">Рег. {formatAdminDate(entry.registeredAt)}</p>
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
                  <dt>Последний визит</dt>
                  <dd>{formatAdminDate(selected.lastSeenAt)}</dd>
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
                {canBlockUsers ? (
                  <button
                    type="button"
                    className="admin-action-icon"
                    onClick={() => onBlockToggle(selected)}
                    disabled={busy || selected.isMasterAdmin}
                    title={
                      blockedEmails.includes(selected.email.toLowerCase())
                        ? 'Разблокировать'
                        : 'Заблокировать'
                    }
                    aria-label={
                      blockedEmails.includes(selected.email.toLowerCase())
                        ? 'Разблокировать'
                        : 'Заблокировать'
                    }
                  >
                    <Ban size={18} />
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
                    <MessageSquare size={16} /> Написать пользователю
                  </h3>
                  <p className="muted">
                    Создаст обращение и положит уведомление в ленту этого аккаунта.
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
                  <button type="submit" className="btn btn-primary" disabled={message.trim().length < 2}>
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
              Выбери пользователя слева, чтобы увидеть детали, заблокировать или написать.
            </p>
          )}
        </aside>
      </div>

      {notice ? <p className="feedback-notice">{notice}</p> : null}
      {error ? <p className="feedback-error">{error}</p> : null}
    </main>
  )
}
