import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Clock3, Heart, MessageCircle } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { LikesRow } from '../components/LikesRow'
import { PhotoGalleryModal } from '../components/PhotoGalleryModal'
import { ProfilePhotoCarousel } from '../components/ProfilePhotoCarousel'
import { SafetyActions } from '../components/SafetyActions'
import { SectionTitle } from '../components/SectionTitle'
import { useApp } from '../context/useApp'
import { displayName, experienceLabel, getUser, getUserGyms, intentLabel } from '../data/mock'
import { profileImage } from '../lib/avatar'
import { otherParticipantId } from '../lib/conversations'
import { isDemoAccount } from '../lib/demoAccount'
import { GREETING_MESSAGE_MAX } from '../lib/fieldLimits'
import { messageFieldProps } from '../lib/inputAttrs'
import { getCheckedInGymId } from '../lib/presence'
import { breakLabel, isOnBreak } from '../lib/schedule'
import { formatUsername } from '../lib/username'
import type { UserProfile } from '../types'
import './ProfileViews.css'

const DEFAULT_GREETING = 'Привет! Увидел тебя в Spotter.'

export function UserProfilePage() {
  const { userId = '' } = useParams()
  const {
    user,
    directory,
    conversations,
    startConversation,
    toggleLike,
    getLikesFor,
    fetchUserById,
    apiOnline,
  } = useApp()
  const navigate = useNavigate()
  const [remote, setRemote] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  const localPerson =
    (user && user.id === userId ? user : null) ||
    directory.find((u) => u.id === userId) ||
    (isDemoAccount(user?.email) ? getUser(userId) : undefined) ||
    null

  const person = remote || localPerson
  const hasLocal = Boolean(localPerson)

  useEffect(() => {
    setRemote(null)
    setLoadError('')
    if (!userId || hasLocal) return
    if (!apiOnline) {
      setLoadError('Пользователь не найден')
      return
    }
    let cancelled = false
    setLoading(true)
    void fetchUserById(userId)
      .then((found) => {
        if (!cancelled) setRemote(found)
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Пользователь не найден')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId, hasLocal, apiOnline, fetchUserById])

  const gyms = person ? getUserGyms(person) : []
  const [message, setMessage] = useState('')
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

  const name = displayName(person)
  const isAnon = person.privacy === 'anonymous'
  const isSelf = Boolean(user && person.id === user.id)
  const photo = profileImage(person)
  const galleryPhotos = isAnon ? [] : person.photos
  const onBreak = isOnBreak(person.breakUntil)
  const breakText = breakLabel(person.breakUntil)

  const onSend = async (e: FormEvent) => {
    e.preventDefault()
    const text = message.trim() || DEFAULT_GREETING
    const id = await startConversation(person.id, text)
    navigate(`/app/messages/${id}`, { state: { from: `/app/user/${person.id}` } })
  }

  const openExistingChat = () => {
    if (!existingConversationId) return
    navigate(`/app/messages/${existingConversationId}`, {
      state: { from: `/app/user/${person.id}` },
    })
  }

  return (
    <main className="page profile-view">
      <header className="profile-other-top">
        <button type="button" className="back-link" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} /> Назад
        </button>
        {!isSelf ? <SafetyActions person={person} /> : null}
      </header>

      <div className="profile-hero">
        <ProfilePhotoCarousel
          photos={galleryPhotos}
          fallbackSrc={photo}
          name={name}
          onOpen={(index) => {
            if (!galleryPhotos.length) return
            setGalleryIndex(index)
            setGalleryOpen(true)
          }}
        />
        <div className="profile-hero-meta">
          {onBreak ? (
            <span className="pill pill-break">{breakText}</span>
          ) : person.isActive ? (
            <span className="pill pill-online">
              <span className="online-dot" />В зале
            </span>
          ) : (
            <span className="pill pill-offline">Не в зале</span>
          )}
          <h1>
            {name}
            {!isAnon ? <span>, {person.age}</span> : null}
          </h1>
          {person.username ? (
            <p className="profile-username-static">{formatUsername(person.username)}</p>
          ) : null}
          <p className="muted">
            {!isAnon && person.isCoach
              ? person.coachSports.length
                ? `Тренер · ${person.coachSports.join(', ')}`
                : 'Тренер'
              : intentLabel(person.intent)}
          </p>
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
          {!isAnon && person.isCoach ? (
            <span className="pill pill-coach" style={{ marginTop: 8 }}>
              Тренер
            </span>
          ) : null}
        </div>
      </div>

      <PhotoGalleryModal
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        photos={galleryPhotos}
        fallbackSrc={photo}
        name={name}
        initialIndex={galleryIndex}
      />

      <section className="surface profile-block likes-block">
        <SectionTitle
          action={
            !isSelf ? (
              <button
                type="button"
                className={`like-btn ${likesInfo.likedByMe ? 'liked' : ''}`}
                onClick={() => toggleLike(person.id)}
                aria-pressed={likesInfo.likedByMe}
              >
                <Heart size={18} fill={likesInfo.likedByMe ? 'currentColor' : 'none'} />
                {likesInfo.likedByMe ? 'Нравится' : 'Лайк'}
              </button>
            ) : undefined
          }
        >
          Лайки в зале
        </SectionTitle>
        <LikesRow count={likesInfo.count} likers={likesInfo.likers} maxAvatars={6} />
      </section>

      {!isAnon && person.bio ? (
        <section className="surface profile-block">
          <SectionTitle>О себе</SectionTitle>
          <p>{person.bio}</p>
        </section>
      ) : (
        <section className="surface profile-block">
          <SectionTitle>Анонимный профиль</SectionTitle>
          <p className="muted">Имя и фото скрыты. Можно написать запрос — человек сам решит, открыться ли.</p>
        </section>
      )}

      <section className="surface profile-block">
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
              {person.sports.map((tag) => (
                <span
                  key={tag}
                  className={`chip ${person.isCoach && person.coachSports.includes(tag) ? 'coach' : 'active'}`}
                >
                  {tag}
                </span>
              ))}
            </>
          )}
        </div>
      </section>

      {!isAnon ? (
        <section className="surface profile-block">
          <SectionTitle>
            <span className="row">
              <Clock3 size={18} aria-hidden /> Обычно в зале
            </span>
          </SectionTitle>
          {onBreak ? <p className="break-note">{breakText}</p> : null}
          <div className="slots">
            {person.visitSlots.length ? (
              person.visitSlots.map((slot) => (
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

      {!isSelf ? (
        <div className="profile-cta">
          {existingConversationId ? (
            <button type="button" className="btn btn-primary btn-block" onClick={openExistingChat}>
              <MessageCircle size={18} />
              Открыть чат
            </button>
          ) : !openComposer ? (
            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={!person.lookingToMeet}
              onClick={() => setOpenComposer(true)}
            >
              <MessageCircle size={18} />
              {person.lookingToMeet ? 'Написать' : 'Сейчас не открыт к общению'}
            </button>
          ) : (
            <form className="composer" onSubmit={onSend}>
              <textarea
                {...messageFieldProps}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={DEFAULT_GREETING}
                autoFocus
                maxLength={GREETING_MESSAGE_MAX}
              />
              <p className="composer-hint muted">
                {message.trim()
                  ? 'Уйдёт твой текст'
                  : 'Поле пустое — уйдёт приветствие из подсказки. Начни печатать — напишешь своё, стирать ничего не нужно.'}
              </p>
              <button type="submit" className="btn btn-primary btn-block">
                {message.trim() ? 'Отправить запрос' : 'Отправить приветствие'}
              </button>
            </form>
          )}
        </div>
      ) : null}
    </main>
  )
}
