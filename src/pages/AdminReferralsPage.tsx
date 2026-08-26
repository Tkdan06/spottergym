import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link2, RefreshCw, UserPlus, Users } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { SubpageHeader } from '../components/SubpageHeader'
import { useApp } from '../context/useApp'
import {
  apiAdminFetchReferrals,
  type ReferralAnalytics,
  type ReferralUserBrief,
} from '../lib/apiClient'
import { formatAdminDate } from '../lib/adminStats'
import './FeedbackPage.css'
import './AdminPlayersPage.css'
import './AdminReferralsPage.css'

function formatWhen(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function userLabel(u: ReferralUserBrief) {
  if (!u.id) return 'Удалён'
  const handle = u.username ? `@${u.username}` : u.email
  return u.deleted ? `${u.name} (удалён)` : `${u.name} · ${handle}`
}

function inviteUrl(userId: string) {
  return `https://spottergym.ru/register?invite=${encodeURIComponent(userId)}`
}

export function AdminReferralsPage() {
  const navigate = useNavigate()
  const { user, canViewUsers } = useApp()
  const [data, setData] = useState<ReferralAnalytics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'leaders' | 'feed'>('leaders')
  const [copiedId, setCopiedId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await apiAdminFetchReferrals())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить рефералы')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const q = query.trim().toLowerCase()

  const leaders = useMemo(() => {
    const list = data?.leaders ?? []
    if (!q) return list
    return list.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q) ||
        (row.username || '').toLowerCase().includes(q) ||
        row.city.toLowerCase().includes(q) ||
        (row.tierTitle || '').toLowerCase().includes(q),
    )
  }, [data?.leaders, q])

  const recent = useMemo(() => {
    const list = data?.recent ?? []
    if (!q) return list
    return list.filter((row) => {
      const hay = [
        row.inviter.name,
        row.inviter.email,
        row.inviter.username,
        row.invitee.name,
        row.invitee.email,
        row.invitee.username,
        row.inviter.city,
        row.invitee.city,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [data?.recent, q])

  const copyLink = async (userId: string) => {
    const url = inviteUrl(userId)
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(userId)
      window.setTimeout(() => setCopiedId((id) => (id === userId ? '' : id)), 2000)
    } catch {
      /* ignore */
    }
  }

  if (!user?.isAdmin) return <Navigate to="/app/profile" replace />
  if (!canViewUsers) return <Navigate to="/app/admin" replace />

  const s = data?.summary

  return (
    <main className="page admin-page admin-players-page admin-referrals-page">
      <SubpageHeader
        title="Рефералы"
        onBack={() => navigate('/app/admin')}
        action={
          <button
            type="button"
            className="btn-icon-refresh"
            onClick={() => void load()}
            aria-label="Обновить"
            disabled={loading}
          >
            <RefreshCw size={22} strokeWidth={2.4} />
          </button>
        }
      />
      <p className="muted">
        Кто кого пригласил · засчёт после онбординга
        {loading ? ' · обновляем…' : ''}
        {data ? ` · ${formatAdminDate(data.generatedAt)}` : ''}
      </p>

      {error ? <p className="admin-inline-error">{error}</p> : null}

      <section className="admin-stat-grid" aria-label="Сводка рефералов">
        <article className="admin-stat-card">
          <span className="muted">В зачёте</span>
          <strong>{s?.creditedInvites ?? '—'}</strong>
          <p className="dim">онбординг пройден · всего ссылок {s?.totalInvites ?? '—'}</p>
        </article>
        <article className="admin-stat-card">
          <span className="muted">Пригласили</span>
          <strong>{s?.uniqueInviters ?? '—'}</strong>
          <p className="dim">ждут онбординг {s?.pendingInvites ?? '—'}</p>
        </article>
        <article className="admin-stat-card">
          <span className="muted">За 7 дней</span>
          <strong>{s?.credited7d ?? '—'}</strong>
          <p className="dim">
            в зачёте · реги {s?.invites7d ?? '—'} · 24ч {s?.invites24h ?? '—'}
          </p>
        </article>
        <article className="admin-stat-card">
          <span className="muted">Доля рефералов</span>
          <strong>{s?.referredSharePct != null ? `${s.referredSharePct}%` : '—'}</strong>
          <p className="dim">
            реф. {s?.referredUsers ?? '—'} · органика {s?.organicUsers ?? '—'} из{' '}
            {s?.activeUsers ?? '—'}
          </p>
        </article>
      </section>

      <label className="admin-referrals-search">
        <span className="muted">Поиск</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Имя, @ник, email, статус…"
          autoComplete="off"
        />
      </label>

      <div className="admin-referrals-tabs" role="tablist" aria-label="Разделы рефералов">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'leaders'}
          className={tab === 'leaders' ? 'active' : ''}
          onClick={() => setTab('leaders')}
        >
          <Users size={16} aria-hidden />
          Лидеры
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'feed'}
          className={tab === 'feed' ? 'active' : ''}
          onClick={() => setTab('feed')}
        >
          <UserPlus size={16} aria-hidden />
          Кто кого
        </button>
      </div>

      {tab === 'leaders' ? (
        <section className="admin-players-section">
          <h2>Топ по засчитываемым</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Сортировка по друзьям с завершённым онбордингом. Статус — лестница круга Spotter.
          </p>
          {!leaders.length ? (
            <p className="dim">Пока никто никого не пригласил — или поиск ничего не нашёл.</p>
          ) : (
            <ul className="admin-players-list admin-referrals-list">
              {leaders.map((row, index) => (
                <li key={row.id}>
                  <div className="admin-referrals-row">
                    <span className="admin-referrals-rank">{index + 1}</span>
                    <div className="admin-referrals-main">
                      <strong>
                        {row.id ? (
                          <Link to={`/app/admin/players?q=${encodeURIComponent(row.email || row.name)}`}>
                            {userLabel(row)}
                          </Link>
                        ) : (
                          userLabel(row)
                        )}
                      </strong>
                      <p className="muted">
                        {row.tierTitle || 'без статуса'} · {row.city || 'город —'} · последний{' '}
                        {formatWhen(row.lastInviteAt)}
                      </p>
                      <p className="dim">
                        в зачёте {row.creditedCount} · всего {row.inviteCount}
                        {row.pendingCount ? ` · ждут ${row.pendingCount}` : ''}
                      </p>
                      <p className="dim admin-referrals-link">{inviteUrl(row.id)}</p>
                    </div>
                    <div className="admin-referrals-actions">
                      <span className="admin-referrals-count">{row.creditedCount}</span>
                      <button
                        type="button"
                        className="btn btn-ghost admin-referrals-copy"
                        onClick={() => void copyLink(row.id)}
                        disabled={!row.id}
                      >
                        <Link2 size={16} aria-hidden />
                        {copiedId === row.id ? 'Скопировано' : 'Ссылка'}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section className="admin-players-section">
          <h2>Лента приглашений</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Регистрации по ссылке. «В зачёте» — invitee прошёл онбординг.
          </p>
          {!recent.length ? (
            <p className="dim">Пока пусто — или поиск ничего не нашёл.</p>
          ) : (
            <ul className="admin-players-list admin-referrals-list">
              {recent.map((row) => (
                <li key={row.id}>
                  <div className="admin-referrals-feed">
                    <p className="admin-referrals-when muted">
                      {formatWhen(row.createdAt)}
                      {row.credited ? ' · в зачёте' : ' · ждёт онбординг'}
                    </p>
                    <p>
                      <strong>
                        {row.inviter.id ? (
                          <Link
                            to={`/app/admin/players?q=${encodeURIComponent(row.inviter.email || row.inviter.name)}`}
                          >
                            {userLabel(row.inviter)}
                          </Link>
                        ) : (
                          userLabel(row.inviter)
                        )}
                      </strong>
                      <span className="muted"> пригласил </span>
                      <strong>
                        {row.invitee.id ? (
                          <Link
                            to={`/app/admin/players?q=${encodeURIComponent(row.invitee.email || row.invitee.name)}`}
                          >
                            {userLabel(row.invitee)}
                          </Link>
                        ) : (
                          userLabel(row.invitee)
                        )}
                      </strong>
                    </p>
                    <p className="dim">
                      {[row.inviter.city, row.invitee.city].filter(Boolean).join(' → ') || 'города —'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  )
}
