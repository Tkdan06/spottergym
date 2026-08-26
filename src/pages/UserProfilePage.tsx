import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Clock3, Eye, Heart, MessageCircle, Shield } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { LikesRow } from '../components/LikesRow'
import { PhotoGalleryModal } from '../components/PhotoGalleryModal'
import { ProfilePhotoCarousel } from '../components/ProfilePhotoCarousel'
import { ReferralBadge, isReferralStatusVisible } from '../components/ReferralBadge'
import { SoftFlash } from '../components/SoftFlash'
import { SubpageBack } from '../components/SubpageHeader'
import { SafetyActions } from '../components/SafetyActions'
import { SectionTitle } from '../components/SectionTitle'
import { SmartImage } from '../components/SmartImage'
import { useApp } from '../context/useApp'
import { displayName, experienceLabel, getUser, getUserGyms } from '../data/mock'
import { localGenderAvatar, profileImage } from '../lib/avatar'
import { otherParticipantId } from '../lib/conversations'
import { isDemoAccount } from '../lib/demoAccount'
import { GREETING_MESSAGE_MAX } from '../lib/fieldLimits'
import { messageFieldProps } from '../lib/inputAttrs'
import { getCheckedInGymId } from '../lib/presence'
import { breakLabel, isOnBreak } from '../lib/schedule'
import { InstagramIcon } from '../components/InstagramIcon'
import { formatUsername } from '../lib/username'
import { formatInstagram, instagramProfileUrl, normalizeInstagram } from '../lib/instagram'
import type { UserProfile } from '../types'
import './FeedbackPage.css'
import './ProfileViews.css'

const DEFAULT_GREETING = 'Привет! Увидел тебя в Spotter.'

function isProfileLike(value: unknown): value is UserProfile {
  return Boolean(value && typeof value === 'object' && typeof (value as UserProfile).id === 'string')
}

export function UserProfilePage() {
  const { userId = '' } = useParams()
  const location = useLocation()
  const {
    user,
    directory,
    conversations,
    startConversation,
    toggleLike,
    getLikesFor,
    fetchUserById,
    rememberUser,
    apiOnline,
    canViewUsers,
  } = useApp()
  const navigate = useNavigate()
  const [remote, setRemote] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [likeError, setLikeError] = useState('')
  const [likeFlash, setLikeFlash] = useState('')
  const [adminRevealed, setAdminRevealed] = useState(false)
  const [revealBusy, setRevealBusy] = useState(false)
  const [revealError, setRevealError] = useState('')
  const fetchUserByIdRef = useRef(fetchUserById)
  fetchUserByIdRef.current = fetchUserById

  const statePerson = isProfileLike(
    (location.state as { person?: unknown } | null)?.person,
  )
    ? ((location.state as { person: UserProfile }).person)
    : null

  const localPerson =
    (user && user.id === userId ? user : null) ||
    (statePerson && statePerson.id === userId ? statePerson : null) ||
    directory.find((u) => u.id === userId) ||
    (isDemoAccount(user?.email) ? getUser(userId) : undefined) ||
    null

  const person = remote || localPerson

  useEffect(() => {
    if (statePerson && statePerson.id === userId) {
      rememberUser(statePerson)
    }
  }, [userId, statePerson, rememberUser])

  useEffect(() => {
    setRemote(null)
    setLoadError('')
    setAdminRevealed(false)
    setRevealError('')
    if (!userId) return

    if (!apiOnline) {
      if (!localPerson) setLoadError('Пользователь не найден')
      return
    }

    let cancelled = false
    // Keep showing cached/state person while refreshing — avoid empty flash
    if (!localPerson) setLoading(true)

    void fetchUserByIdRef
      .current(userId, { bypassCache: true })
      .then((found) => {
        if (!cancelled) setRemote(found)
      })
      .catch((err) => {
        if (!cancelled && !localPerson) {
          setLoadError(err instanceof Error ? err.message : 'Пользователь не найден')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // localPerson intentionally omitted: only re-fetch when route/api changes
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable fetch via ref; localPerson is stale-while-revalidate seed
  }, [userId, apiOnline])

  const gyms = person ? getUserGyms(person) : []
  const [message, setMessage] = useState('')
  const [sendBusy, setSendBusy] = useState(false)
  const [sendError, setSendError] = useState('')
  const [openComposer, setOpenComposer] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const likesInfo = getLikesFor(userId)

  const existingConversationId = useMemo(() => {
    if (!person || !user) return null
    const found = conversations.find((c) => otherParticipantId(c, user.id) === person.id)
    return found?.id ?? null
  }, [conversations, person, user])

  if (loading && !person) {
    return (
      <main className="page">
        <p className="muted">Загрузка профиля…</p>
      </main>
    )
  }

  if (!person) {
    return (
      <main className="page">
        <p>{loadError || 'Пользователь не найден'}</p>
        <Link to="/app">Назад</Link>
      </main>
    )
  }

  if (person.isDeleted) {
    return (
      <main className="page">
        <SubpageBack onClick={() => navigate(-1)} />
        <div className="empty-copy" style={{ marginTop: 24 }}>
          <SmartImage
            src="/images/deleted-user.svg"
            alt=""
            size="avatar"
            priority
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              margin: '0 auto 12px',
            }}
          />
          <p className="empty-copy-title">Удалённый пользователь</p>
          <p className="empty-copy-lead">Этот аккаунт удалён. Переписку можно открыть в чатах.</p>
        </div>
      </main>
    )
  }

  const name = displayName(person)
  const privacyAnonymous = person.privacy === 'anonymous'
  const isAnon = privacyAnonymous && !adminRevealed
  const isSelf = Boolean(user && person.id === user.id)
  const canAdminMessage = Boolean(user?.isAdmin) && !isSelf
  const canRevealAnon =
    Boolean(canViewUsers) && privacyAnonymous && !isSelf && !adminRevealed && apiOnline
  const canStartChat = Boolean(person.lookingToMeet || canAdminMessage)
  const photo = profileImage(person)
  const galleryPhotos = isAnon ? [] : Array.isArray(person.photos) ? person.photos : []
  const sports = Array.isArray(person.sports) ? person.sports : []
  const coachSports = Array.isArray(person.coachSports) ? person.coachSports : []
  const visitSlots = Array.isArray(person.visitSlots) ? person.visitSlots : []
  const onBreak = isOnBreak(person.breakUntil)
  const breakText = breakLabel(person.breakUntil)

  const onAdminReveal = () => {
    setRevealError('')
    setRevealBusy(true)
    void fetchUserById(person.id, { bypassCache: true, revealAnonymous: true })
      .then((found) => {
        setRemote(found)
        setAdminRevealed(true)
      })
      .catch((err: unknown) => {
        setRevealError(err instanceof Error ? err.message : 'Не удалось открыть')
      })
      .finally(() => setRevealBusy(false))
  }

  const onHideAdminReveal = () => {
    setAdminRevealed(false)
    setRevealError('')
    setRevealBusy(true)
    void fetchUserById(person.id, { bypassCache: true })
      .then((found) => setRemote(found))
      .catch(() => {
        /* keep last remote */
      })
      .finally(() => setRevealBusy(false))
  }

  const onSend = async (e: FormEvent) => {
    e.preventDefault()
    if (sendBusy) return
    const text = message.trim() || DEFAULT_GREETING
    setSendBusy(true)
    setSendError('')
    try {
      const id = await startConversation(person.id, text)
      navigate(`/app/messages/${id}`, { state: { from: `/app/user/${person.id}` } })
    } catch (err) {
      const cid =
        err && typeof err === 'object' && 'conversationId' in err
          ? (err as { conversationId?: string }).conversationId
          : undefined
      if (typeof cid === 'string' && cid) {
        navigate(`/app/messages/${cid}`, { state: { from: `/app/user/${person.id}` } })
        return
      }
      setSendError(err instanceof Error ? err.message : 'Не удалось начать чат')
    } finally {
      setSendBusy(false)
    }
  }

  const openExistingChat = () => {
    if (!existingConversationId) return
    navigate(`/app/messages/${existingConversationId}`, {
      state: { from: `/app/user/${person.id}` },
    })
  }

  const onToggleLike = () => {
    setLikeError('')
    const nextLiked = !likesInfo.likedByMe
    void Promise.resolve(toggleLike(person.id))
      .then(() => {
        setLikeFlash(nextLiked ? 'Лайк поставлен' : 'Лайк снят')
        window.setTimeout(() => setLikeFlash(''), 1800)
      })
      .catch((err: unknown) => {
        setLikeError(err instanceof Error ? err.message : 'Не удалось поставить лайк')
      })
  }

  return (
    <main className="page profile-view">
      <header className="profile-other-top">
        <SubpageBack onClick={() => navigate(-1)} />
        {!isSelf ? <SafetyActions person={person} /> : null}
      </header>

      <div className="profile-hero-cover">
        <div className="profile-hero-cover-photo">
          <ProfilePhotoCarousel
            cover
            photos={galleryPhotos}
            fallbackSrc={photo}
            errorFallbackSrc={localGenderAvatar(person.gender)}
            name={name}
            onOpen={(index) => {
              if (!galleryPhotos.length) return
              setGalleryIndex(index)
              setGalleryOpen(true)
            }}
          />
          <div className="profile-hero-cover-scrim" aria-hidden />
          <div className="profile-hero-cover-top">
            {onBreak ? (
              <span className="pill pill-break">{breakText}</span>
            ) : person.isActive ? (
              <span className="pill pill-online">
                <span className="online-dot" />В зале
              </span>
            ) : (
              <span className="pill pill-offline">Не в зале</span>
            )}
            {!isAnon &&
            isReferralStatusVisible(person) &&
            (person.referralTier || person.referralTitle) ? (
              <ReferralBadge user={person} size="lg" className="referral-badge--on-cover" />
            ) : null}
          </div>
          <div className="profile-hero-cover-copy">
            <div className="profile-hero-cover-copy-text">
              <h1>
                {name}
                {!isAnon ? <span>, {person.age}</span> : null}
              </h1>
              {person.username ? (
                <p className="profile-hero-cover-handle">{formatUsername(person.username)}</p>
              ) : null}
            </div>
            {!isSelf ? (
              <div className="profile-hero-cover-actions">
                <button
                  type="button"
                  className={`icon-btn profile-hero-cover-like ${likesInfo.likedByMe ? 'liked' : ''}`}
                  aria-label={likesInfo.likedByMe ? 'Убрать лайк' : 'Лайк'}
                  aria-pressed={likesInfo.likedByMe}
                  onClick={onToggleLike}
                >
                  <Heart size={18} fill={likesInfo.likedByMe ? 'currentColor' : 'none'} />
                </button>
                <button
                  type="button"
                  className="icon-btn profile-hero-cover-chat"
                  aria-label={
                    existingConversationId
                      ? 'Открыть чат'
                      : canStartChat
                        ? 'Написать'
                        : 'Сейчас не открыт к общению'
                  }
                  disabled={!existingConversationId && !canStartChat}
                  onClick={() => {
                    if (existingConversationId) {
                      openExistingChat()
                      return
                    }
                    if (canStartChat) setOpenComposer(true)
                  }}
                >
                  <MessageCircle size={18} />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {adminRevealed ? (
        <div className="profile-admin-reveal-banner" role="status">
          <Shield size={16} aria-hidden />
          <span>Просмотр как админ — для остальных профиль анонимный</span>
          <button
            type="button"
            className="profile-admin-reveal-hide"
            onClick={onHideAdminReveal}
            disabled={revealBusy}
          >
            Скрыть
          </button>
        </div>
      ) : null}

      {canRevealAnon ? (
        <div className="profile-admin-reveal-actions">
          <button
            type="button"
            className="btn btn-ghost btn-block"
            onClick={onAdminReveal}
            disabled={revealBusy}
          >
            <Eye size={18} />
            {revealBusy ? 'Открываем…' : 'Открыть профиль как админ'}
          </button>
          {revealError ? (
            <p className="feedback-error" role="alert">
              {revealError}
            </p>
          ) : null}
        </div>
      ) : null}

      {!isSelf && !existingConversationId && openComposer ? (
        <div className="profile-cta">
          <form className="composer" onSubmit={(e) => void onSend(e)}>
            <textarea
              {...messageFieldProps}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={DEFAULT_GREETING}
              autoFocus
              disabled={sendBusy}
              maxLength={GREETING_MESSAGE_MAX}
            />
            <p className="composer-hint muted">
              {message.trim()
                ? 'Уйдёт твой текст'
                : 'Поле пустое — уйдёт приветствие из подсказки. Начни печатать — напишешь своё, стирать ничего не нужно.'}
            </p>
            {sendError ? (
              <p className="feedback-error" role="alert">
                {sendError}
              </p>
            ) : null}
            <button type="submit" className="btn btn-primary btn-block" disabled={sendBusy}>
              {sendBusy
                ? 'Отправляем…'
                : message.trim()
                  ? 'Отправить запрос'
                  : 'Отправить приветствие'}
            </button>
          </form>
        </div>
      ) : null}

      <div className="profile-hero-meta profile-hero-meta--after-cover">
        <div className="profile-identity">
          {!isAnon && isReferralStatusVisible(person) && person.referralTitle ? (
            <div className="profile-handle-row">
              <span className="profile-status-mark">{person.referralTitle}</span>
            </div>
          ) : null}
          {!isAnon && normalizeInstagram(person.instagram || '') ? (
            <a
              className="profile-instagram-link"
              href={instagramProfileUrl(person.instagram || '')}
              target="_blank"
              rel="noopener noreferrer"
              title={`Открыть Instagram ${formatInstagram(person.instagram)}`}
              aria-label={`Instagram ${formatInstagram(person.instagram)}`}
            >
              <InstagramIcon width={16} height={16} aria-hidden />
              <span className="profile-instagram-label">Instagram</span>
              <span className="profile-instagram-handle">
                {formatInstagram(person.instagram)}
              </span>
            </a>
          ) : null}
        </div>
        {gyms.length ? (
          <div className="profile-gym-links" aria-label="Залы пользователя">
            {gyms.map((gym) => {
              const here = person.isActive && getCheckedInGymId(person) === gym.id
              return (
                <Link
                  key={gym.id}
                  to={`/app/gym/${gym.id}`}
                  className={`chip active profile-gym-link ${here ? 'is-here' : ''}`}
                >
                  {gym.name}
                  {here ? ' · сейчас' : ''}
                </Link>
              )
            })}
          </div>
        ) : (
          <p className="dim">Зал не указан</p>
        )}
      </div>

      <PhotoGalleryModal
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        photos={galleryPhotos}
        fallbackSrc={photo}
        errorFallbackSrc={localGenderAvatar(person.gender)}
        name={name}
        initialIndex={galleryIndex}
      />

      <section className="profile-block likes-block">
        <SectionTitle>Лайки в зале</SectionTitle>
        {likeError ? (
          <p className="feedback-error" role="alert">
            {likeError}
          </p>
        ) : null}
        <LikesRow count={likesInfo.count} likers={likesInfo.likers} maxAvatars={6} />
      </section>

      {isAnon ? (
        <section className="profile-block">
          <SectionTitle>Анонимный профиль</SectionTitle>
          <p className="muted">
            Имя и фото скрыты. Если человек открыт к общению — можно написать запрос; он сам решит,
            открыться ли.
          </p>
        </section>
      ) : person.bio ? (
        <section className="profile-block">
          <SectionTitle>О себе</SectionTitle>
          <p>{person.bio}</p>
        </section>
      ) : null}

      <section className="profile-block">
        <SectionTitle>
          {!isAnon && person.isCoach ? 'Направления и активности' : 'Активности'}
        </SectionTitle>
        <div className="chip-grid">
          {isAnon ? (
            <span className="chip active">Скрыто</span>
          ) : (
            <>
              {experienceLabel(person.experienceLevel) ? (
                <span className="chip level">{experienceLabel(person.experienceLevel)}</span>
              ) : null}
              {person.isCoach ? <span className="chip coach">Тренер</span> : null}
              {sports.map((tag) => (
                <span
                  key={tag}
                  className={`chip ${person.isCoach && coachSports.includes(tag) ? 'coach' : 'active'}`}
                >
                  {tag}
                </span>
              ))}
            </>
          )}
        </div>
      </section>

      {!isAnon ? (
        <section className="profile-block">
          <SectionTitle>
            <span className="row">
              <Clock3 size={18} aria-hidden /> Обычно в зале
            </span>
          </SectionTitle>
          {onBreak ? <p className="break-note">{breakText}</p> : null}
          <div className="slots">
            {visitSlots.length ? (
              visitSlots.map((slot) => (
                <div key={`${slot.day}-${slot.from}`} className="slot">
                  <strong>{slot.day}</strong>
                  <span>
                    {slot.from}–{slot.to}
                  </span>
                </div>
              ))
            ) : (
              <p className="muted">Расписание не указано</p>
            )}
          </div>
        </section>
      ) : null}

      <SoftFlash message={likeFlash} />
    </main>
  )
}
