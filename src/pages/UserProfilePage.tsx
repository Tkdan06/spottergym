import { type FormEvent, useState } from 'react'
import { ArrowLeft, Clock3, Heart, MessageCircle } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { LikesRow } from '../components/LikesRow'
import { PhotoGalleryModal } from '../components/PhotoGalleryModal'
import { ProfilePhotoCarousel } from '../components/ProfilePhotoCarousel'
import { useApp } from '../context/useApp'
import { displayName, experienceLabel, getUser, getUserGyms, intentLabel } from '../data/mock'
import { profileImage } from '../lib/avatar'
import './ProfileViews.css'

const DEFAULT_GREETING = 'Привет! Увидел тебя в Spotter.'

export function UserProfilePage() {
  const { userId = '' } = useParams()
  const { startConversation, toggleLike, getLikesFor } = useApp()
  const navigate = useNavigate()
  const person = getUser(userId)
  const gyms = person ? getUserGyms(person) : []
  const [message, setMessage] = useState('')
  const [openComposer, setOpenComposer] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const likesInfo = getLikesFor(userId)

  if (!person) {
    return (
      <main className="page">
        <p>Пользователь не найден</p>
        <Link to="/app">Назад</Link>
      </main>
    )
  }

  const name = displayName(person)
  const isAnon = person.privacy === 'anonymous'
  const photo = profileImage(person)
  const galleryPhotos = isAnon ? [] : person.photos

  const onSend = (e: FormEvent) => {
    e.preventDefault()
    const text = message.trim() || DEFAULT_GREETING
    const id = startConversation(person.id, text)
    navigate(`/app/messages/${id}`)
  }

  return (
    <main className="page profile-view">
      <button type="button" className="back-link" onClick={() => navigate(-1)}>
        <ArrowLeft size={18} /> Назад
      </button>

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
          {person.isActive ? (
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
          <p className="muted">
            {!isAnon && person.isCoach
              ? person.coachSports.length
                ? `Тренер · ${person.coachSports.join(', ')}`
                : 'Тренер'
              : intentLabel(person.intent)}
          </p>
          <p className="dim">
            {gyms.length ? gyms.map((g) => g.name).join(' · ') : 'Зал не указан'}
          </p>
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
        <div className="likes-block-head">
          <h2>Лайки в зале</h2>
          <button
            type="button"
            className={`like-btn ${likesInfo.likedByMe ? 'liked' : ''}`}
            onClick={() => toggleLike(person.id)}
            aria-pressed={likesInfo.likedByMe}
          >
            <Heart size={18} fill={likesInfo.likedByMe ? 'currentColor' : 'none'} />
            {likesInfo.likedByMe ? 'Нравится' : 'Лайк'}
          </button>
        </div>
        <LikesRow count={likesInfo.count} likers={likesInfo.likers} maxAvatars={6} />
      </section>

      {!isAnon && person.bio ? (
        <section className="surface profile-block">
          <h2>О себе</h2>
          <p>{person.bio}</p>
        </section>
      ) : (
        <section className="surface profile-block">
          <h2>Анонимный профиль</h2>
          <p className="muted">Имя и фото скрыты. Можно написать запрос — человек сам решит, открыться ли.</p>
        </section>
      )}

      <section className="surface profile-block">
        <h2>{!isAnon && person.isCoach ? 'Направления и активности' : 'Активности'}</h2>
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
          <h2 className="row">
            <Clock3 size={18} /> Обычно в зале
          </h2>
          <div className="slots">
            {person.visitSlots.map((slot) => (
              <div key={`${slot.day}-${slot.from}`} className="slot">
                <strong>{slot.day}</strong>
                <span>
                  {slot.from}–{slot.to}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="profile-cta">
        {!openComposer ? (
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
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={DEFAULT_GREETING}
              autoFocus
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
    </main>
  )
}
