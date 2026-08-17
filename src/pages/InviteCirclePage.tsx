import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Info, Share2, Users } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { InviteFriendsButton } from '../components/InviteFriendsButton'
import { ReferralBadge } from '../components/ReferralBadge'
import { SectionTitle } from '../components/SectionTitle'
import { UserCard } from '../components/UserCard'
import { useApp } from '../context/useApp'
import {
  apiFetchMyReferrals,
  type InviteCirclePayload,
} from '../lib/apiClient'
import { getUserGyms } from '../data/mock'
import { REFERRAL_TIERS, type ReferralTierId } from '../lib/referralTiers'
import type { UserProfile } from '../types'
import './InviteCirclePage.css'

function formatWhen(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  })
}

function friendsInCircleLabel(count: number) {
  if (count === 1) return '1 друг в круге'
  if (count >= 2 && count <= 4) return `${count} друга в круге`
  return `${count} друзей в круге`
}

const LADDER_TIERS = REFERRAL_TIERS.filter((t) => t.id > 0)

export function InviteCirclePage() {
  const navigate = useNavigate()
  const { user } = useApp()
  const [circle, setCircle] = useState<InviteCirclePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hintOpen, setHintOpen] = useState(false)
  const [previewTier, setPreviewTier] = useState<ReferralTierId>(1)
  const hintRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const next = await apiFetchMyReferrals()
      setCircle(next)
      const tier = (next.tier || 1) as ReferralTierId
      setPreviewTier(tier > 0 ? tier : 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить круг')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!hintOpen) return
    const onDoc = (e: MouseEvent) => {
      if (hintRef.current && !hintRef.current.contains(e.target as Node)) {
        setHintOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHintOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [hintOpen])

  const credited = circle?.creditedCount ?? user?.referralCreditedCount ?? 0
  const previewTierDef = REFERRAL_TIERS.find((t) => t.id === previewTier) || LADDER_TIERS[0]

  const previewUser = useMemo((): UserProfile | null => {
    if (!user) return null
    return {
      ...user,
      referralTier: previewTierDef.id,
      referralTitle: previewTierDef.title,
      referralBadge: previewTierDef.badge,
      referralChrome: previewTierDef.chrome,
      referralCreditedCount: Math.max(credited, previewTierDef.minCredited),
    }
  }, [user, previewTierDef, credited])

  if (!user) return <Navigate to="/login" replace />

  const gymName = getUserGyms(user)[0]?.name || user.city
  const title = circle?.title || user.referralTitle || ''
  const toNext = circle?.toNext
  const nextTitle = circle?.nextTitle
  const progressMax = circle?.nextMin ?? 10
  const progressPct = Math.min(100, Math.round((credited / Math.max(1, progressMax)) * 100))
  const realTier = (circle?.tier ?? user.referralTier ?? 0) as ReferralTierId

  return (
    <main className="page invite-circle-page">
      <button type="button" className="back-link" onClick={() => navigate('/app/profile')}>
        <ArrowLeft size={18} /> Профиль
      </button>

      <header className="invite-circle-head">
        <h1 className="page-title">Мой круг</h1>
        <div className="invite-circle-lead">
          <p className="muted">Приглашай друзей — расти в статусе</p>
          <div className="invite-circle-hint" ref={hintRef}>
            <button
              type="button"
              className="invite-circle-hint-btn"
              aria-label="Как засчитываются друзья"
              aria-expanded={hintOpen}
              onClick={() => setHintOpen((v) => !v)}
            >
              <Info size={16} />
            </button>
            {hintOpen ? (
              <div className="invite-circle-hint-pop" role="tooltip">
                Засчитываются друзья, которые зарегистрировались по твоей ссылке и прошли онбординг.
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {error ? <p className="admin-inline-error">{error}</p> : null}

      <section className="surface invite-circle-section invite-circle-status">
        <div className="invite-circle-status-top">
          <div className="invite-circle-status-copy">
            <p className="muted">Твой статус</p>
            <div className="referral-status-inline invite-circle-status-title-row">
              {title ? (
                <ReferralBadge
                  user={{
                    referralTier: circle?.tier ?? user.referralTier,
                    referralBadge: circle?.badge ?? user.referralBadge,
                    referralTitle: title,
                    referralCreditedCount: credited,
                  }}
                  size="md"
                />
              ) : null}
              <strong className="invite-circle-title">
                {title || (loading ? '…' : 'Пока без статуса')}
              </strong>
            </div>
            <p className="dim">
              {friendsInCircleLabel(credited)}
              {circle?.pendingCount ? ` · ${circle.pendingCount} ещё не завершили онбординг` : ''}
            </p>
          </div>
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

      <section className="surface invite-circle-section invite-circle-ladder">
        <SectionTitle>Лестница статусов</SectionTitle>
        <div className="invite-circle-track" role="list" aria-label="Статусы">
          {LADDER_TIERS.map((tier) => {
            const reached = credited >= tier.minCredited
            const current = realTier === tier.id
            const previewing = previewTier === tier.id
            return (
              <button
                key={tier.id}
                type="button"
                role="listitem"
                className={`invite-circle-step ${reached ? 'is-reached' : ''} ${current ? 'is-current' : ''} ${previewing ? 'is-preview' : ''}`}
                aria-pressed={previewing}
                aria-label={`${tier.title}, от ${tier.minCredited}`}
                onClick={() => setPreviewTier(tier.id)}
              >
                <ReferralBadge
                  user={{
                    referralTier: tier.id,
                    referralTitle: tier.title,
                    referralBadge: tier.badge,
                    referralCreditedCount: tier.minCredited,
                  }}
                  size="md"
                />
                <span className="invite-circle-step-count">{tier.minCredited}</span>
              </button>
            )
          })}
        </div>
        <p className="invite-circle-track-caption muted">
          {previewTierDef.title}
          {previewTier !== realTier ? ' · превью' : ''}
        </p>
      </section>

      <section className="surface invite-circle-section">
        <SectionTitle>
          <Users size={16} aria-hidden /> Твой круг
        </SectionTitle>
        {loading && !circle ? (
          <p className="muted">Загружаем…</p>
        ) : !circle?.friends.length && !circle?.pending.length ? (
          <p className="muted">
            Пока пусто. Позови друзей — первый статус откроется после одного засчитываемого
            приглашения.
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

      <section className="surface invite-circle-section invite-circle-preview">
        <SectionTitle>Как выглядит в зале</SectionTitle>
        <p className="muted invite-circle-preview-hint">
          Выбери стикер на лестнице — так будет выглядеть твоя карточка в зале.
        </p>
        {previewUser ? (
          <div className="invite-circle-preview-card">
            <UserCard user={previewUser} enableLike={false} priority staticPreview />
          </div>
        ) : null}
      </section>
    </main>
  )
}
