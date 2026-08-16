import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Share2, Users } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { InviteFriendsButton } from '../components/InviteFriendsButton'
import { ReferralBadge } from '../components/ReferralBadge'
import { SectionTitle } from '../components/SectionTitle'
import { useApp } from '../context/useApp'
import {
  apiFetchMyReferrals,
  type InviteCirclePayload,
} from '../lib/apiClient'
import { getUserGyms } from '../data/mock'
import { REFERRAL_TIERS } from '../lib/referralTiers'
import './InviteCirclePage.css'

function formatWhen(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  })
}

export function InviteCirclePage() {
  const navigate = useNavigate()
  const { user } = useApp()
  const [circle, setCircle] = useState<InviteCirclePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setCircle(await apiFetchMyReferrals())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить круг')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (!user) return <Navigate to="/login" replace />

  const gymName = getUserGyms(user)[0]?.name || user.city
  const credited = circle?.creditedCount ?? user.referralCreditedCount ?? 0
  const title = circle?.title || user.referralTitle || ''
  const toNext = circle?.toNext
  const nextTitle = circle?.nextTitle
  const progressMax = circle?.nextMin ?? 10
  const progressPct = Math.min(100, Math.round((credited / Math.max(1, progressMax)) * 100))

  return (
    <main className="page invite-circle-page">
      <button type="button" className="back-link" onClick={() => navigate('/app/profile')}>
        <ArrowLeft size={18} /> Профиль
      </button>

      <header className="invite-circle-head">
        <p className="invite-circle-kicker">Круг Spotter</p>
        <h1>Приглашай — расти в статусе</h1>
        <p className="muted">
          Засчитываются друзья, которые зарегистрировались по твоей ссылке и прошли онбординг.
        </p>
      </header>

      {error ? <p className="admin-inline-error">{error}</p> : null}

      <section className={`surface invite-circle-status ${circle?.chrome && circle.chrome !== 'none' ? `referral-chrome referral-chrome--${circle.chrome}` : ''}`}>
        <div className="invite-circle-status-top">
          <div>
            <p className="muted">Твой статус</p>
            <strong className="invite-circle-title">
              {title || (loading ? '…' : 'Пока без статуса')}
            </strong>
            <p className="dim">
              {credited}{' '}
              {credited === 1 ? 'друг в круге' : credited >= 2 && credited <= 4 ? 'друга в круге' : 'друзей в круге'}
              {circle?.pendingCount ? ` · ${circle.pendingCount} ещё не завершили онбординг` : ''}
            </p>
          </div>
          {title ? (
            <ReferralBadge
              user={{
                referralTier: circle?.tier ?? user.referralTier,
                referralBadge: circle?.badge ?? user.referralBadge,
                referralTitle: title,
                referralCreditedCount: credited,
              }}
              size="md"
              showTitle
            />
          ) : null}
        </div>

        <div className="invite-circle-progress" aria-label="Прогресс до следующего статуса">
          <div className="invite-circle-progress-track">
            <i style={{ width: `${progressPct}%` }} />
          </div>
          <p className="muted">
            {nextTitle && toNext != null
              ? toNext === 0
                ? `Достигнут ${nextTitle}`
                : `Ещё ${toNext} до «${nextTitle}»`
              : 'Максимальный статус — GymBro Spotter'}
          </p>
        </div>

        <InviteFriendsButton
          userId={user.id}
          gymName={gymName}
          statusTitle={title || undefined}
          className="btn btn-primary btn-block"
        >
          <Share2 size={16} /> Поделиться ссылкой
        </InviteFriendsButton>
      </section>

      <section className="surface invite-circle-ladder">
        <SectionTitle>Лестница статусов</SectionTitle>
        <ul className="invite-circle-tiers">
          {REFERRAL_TIERS.filter((t) => t.id > 0).map((tier) => {
            const reached = credited >= tier.minCredited
            const current = (circle?.tier ?? 0) === tier.id
            return (
              <li
                key={tier.id}
                className={`invite-circle-tier ${reached ? 'is-reached' : ''} ${current ? 'is-current' : ''}`}
              >
                <span className="invite-circle-tier-count">{tier.minCredited}</span>
                <div>
                  <strong>{tier.title}</strong>
                  <p className="dim">от {tier.minCredited} засчитываемых друзей</p>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="surface">
        <SectionTitle>
          <Users size={16} aria-hidden /> Твой круг
        </SectionTitle>
        {loading && !circle ? (
          <p className="muted">Загружаем…</p>
        ) : !circle?.friends.length && !circle?.pending.length ? (
          <p className="muted">
            Пока пусто. Позови gym bro или напарника из своего клуба — первый статус откроется после
            одного засчитываемого приглашения.
          </p>
        ) : (
          <>
            {circle?.friends.length ? (
              <ul className="invite-circle-friends">
                {circle.friends.map((f) => (
                  <li key={f.id}>
                    <Link to={`/app/user/${f.id}`}>
                      <strong>{f.name}</strong>
                      <span className="muted">
                        {f.username ? `@${f.username}` : f.city || 'в круге'} · {formatWhen(f.createdAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
            {circle?.pending.length ? (
              <div className="invite-circle-pending">
                <p className="muted">Ждут онбординг (ещё не в зачёт)</p>
                <ul className="invite-circle-friends">
                  {circle.pending.map((f) => (
                    <li key={f.id}>
                      <strong>{f.name}</strong>
                      <span className="dim">регистрация {formatWhen(f.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </section>
    </main>
  )
}
