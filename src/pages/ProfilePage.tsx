import { useState } from 'react'
import { Bell, Copy, Settings, Share2, Shield } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { LikesRow } from '../components/LikesRow'
import { ReferralBadge, referralChromeClass } from '../components/ReferralBadge'
import { PhotoGalleryModal } from '../components/PhotoGalleryModal'
import { ProfilePhotoCarousel } from '../components/ProfilePhotoCarousel'
import { SoftFlash } from '../components/SoftFlash'
import { ScheduleSheet } from '../components/ScheduleSheet'
import { SectionTitle } from '../components/SectionTitle'
import { useApp } from '../context/useApp'
import { experienceLabel, getUserGyms, intentLabel } from '../data/mock'
import { isDemoAccount } from '../lib/demoAccount'
import { localGenderAvatar, profileImage } from '../lib/avatar'
import { clampPhotos } from '../lib/photos'
import { breakLabel, isOnBreak } from '../lib/schedule'
import { InstagramIcon } from '../components/InstagramIcon'
import { formatUsername } from '../lib/username'
import { formatInstagram, instagramProfileUrl, normalizeInstagram } from '../lib/instagram'
import './FeedbackPage.css'
import './ProfileViews.css'

export function ProfilePage() {
  const { user, updateProfile, getLikesFor, getMyLikedUsers, unreadNotifications } = useApp()
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [copyFlash, setCopyFlash] = useState('')
  if (!user) return <Navigate to="/login" replace />
  const gyms = getUserGyms(user)
  const likesInfo = getLikesFor(user.id)
  const myLiked = getMyLikedUsers()
  const photoCount = user.photos.length
  const heroSrc = profileImage(user)
  const onBreak = isOnBreak(user.breakUntil)
  const breakText = breakLabel(user.breakUntil)

  const patch = (data: Parameters<typeof updateProfile>[0]) => {
    setSaveError('')
    return Promise.resolve(updateProfile(data)).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'Не удалось сохранить'
      setSaveError(message)
      throw err instanceof Error ? err : new Error(message)
    })
  }

  return (
    <main className="page profile-view">
      <header className="page-header profile-top">
        <div className="page-header-text">
          <h1 className="page-title">Профиль</h1>
        </div>
        <div className="page-header-actions profile-top-actions">
          <Link to="/app/notifications" className="icon-btn" aria-label="Уведомления">
            <Bell size={20} />
            {unreadNotifications > 0 ? <i className="nav-badge">{unreadNotifications}</i> : null}
          </Link>
          <Link to="/app/settings" className="icon-btn" aria-label="Настройки">
            <Settings size={20} />
          </Link>
        </div>
      </header>

      {isDemoAccount(user.email) ? (
        <p className="demo-local-banner" role="status">
          Демо-аккаунт: зал и чаты локальные, без живого Postgres. Для QA прод-сценариев зайди
          обычным email.
        </p>
      ) : null}

      {saveError ? (
        <p className="feedback-error" role="alert">
          {saveError}
        </p>
      ) : null}

      <div className={`profile-hero mine ${referralChromeClass(user)}`}>
        <div className="profile-hero-photo-wrap">
          <ProfilePhotoCarousel
            photos={user.photos}
            fallbackSrc={heroSrc}
            errorFallbackSrc={localGenderAvatar(user.gender)}
            name={user.name}
            mine
            emptyHint="Фото"
            onOpen={(index) => {
              setGalleryIndex(index)
              setGalleryOpen(true)
            }}
          />
          {user.referralTier || user.referralTitle ? (
            <ReferralBadge user={user} size="lg" className="referral-badge--on-photo" />
          ) : null}
        </div>
        <div className="profile-hero-meta">
          {onBreak ? <span className="pill pill-break">{breakText}</span> : null}
          <h2 className="profile-hero-name">
            {user.name}, {user.age}
          </h2>
          {user.referralTitle ? (
            <p className="referral-status-title-only">{user.referralTitle}</p>
          ) : null}
          <div className="profile-identity">
            {user.username ? (
              <button
                type="button"
                className="profile-username"
                onClick={() => {
                  void navigator.clipboard
                    ?.writeText(formatUsername(user.username))
                    .then(() => {
                      setCopyFlash('Скопировано')
                      window.setTimeout(() => setCopyFlash(''), 1600)
                    })
                    .catch(() => {
                      setCopyFlash('Не удалось скопировать')
                      window.setTimeout(() => setCopyFlash(''), 1600)
                    })
                }}
                title="Скопировать ник Spotter"
              >
                {formatUsername(user.username)}
                <Copy size={14} aria-hidden />
              </button>
            ) : null}
            {normalizeInstagram(user.instagram || '') ? (
              <a
                className="profile-instagram-link"
                href={instagramProfileUrl(user.instagram || '')}
                target="_blank"
                rel="noopener noreferrer"
                title={`Открыть Instagram ${formatInstagram(user.instagram)}`}
                aria-label={`Instagram ${formatInstagram(user.instagram)}`}
              >
                <InstagramIcon width={16} height={16} aria-hidden />
                <span className="profile-instagram-label">Instagram</span>
                <span className="profile-instagram-handle">
                  {formatInstagram(user.instagram)}
                </span>
              </a>
            ) : null}
          </div>
          <p className="muted">
            {user.isCoach
              ? user.coachSports.length
                ? `Тренер · ${user.coachSports.join(', ')}`
                : 'Тренер'
              : intentLabel(user.intent)}
          </p>
          <p className="dim">
            {gyms.length
              ? `${gyms.length} ${gyms.length === 1 ? 'зал' : gyms.length < 5 ? 'зала' : 'залов'}`
              : 'Зал не выбран'}
          </p>
          <button
            type="button"
            className="profile-photo-link"
            onClick={() => {
              setGalleryIndex(0)
              setGalleryOpen(true)
            }}
          >
            {photoCount ? 'Управлять фото' : 'Загрузить фото профиля'}
          </button>
        </div>
      </div>

      <PhotoGalleryModal
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        photos={user.photos}
        fallbackSrc={user.avatar || heroSrc}
        errorFallbackSrc={localGenderAvatar(user.gender)}
        name={user.name}
        editable
        initialIndex={galleryIndex}
        onChangePhotos={(photos) => {
          void patch({ photos: clampPhotos(photos) })
        }}
      />

      <section className="surface profile-block likes-block">
        <SectionTitle
          action={
            <Link to="/app/likes/sent" className="section-action">
              {myLiked.length ? `Кого я лайкнул · ${myLiked.length}` : 'Кого я лайкнул'}
            </Link>
          }
        >
          Лайки
        </SectionTitle>
        <LikesRow
          count={likesInfo.count}
          likers={likesInfo.likers}
          maxAvatars={6}
          to="/app/likes"
        />
      </section>

      <section className="surface profile-block">
        <SectionTitle>О себе</SectionTitle>
        {user.bio ? (
          <p>{user.bio}</p>
        ) : (
          <div className="empty-copy-actions">
            <div className="empty-copy" role="status">
              <p className="empty-copy-title">Пока без описания</p>
              <p className="empty-copy-lead">Коротко о себе — так проще начать разговор</p>
            </div>
            <Link to="/app/settings" className="btn btn-soft btn-sm btn-block">
              Добавить в настройках
            </Link>
          </div>
        )}
        <div className="chip-grid" style={{ marginTop: 12 }}>
          {experienceLabel(user.experienceLevel) ? (
            <span className="chip level">{experienceLabel(user.experienceLevel)}</span>
          ) : null}
          {user.isCoach ? <span className="chip coach">Тренер</span> : null}
          {user.sports.map((tag) => (
            <span
              key={tag}
              className={`chip ${user.isCoach && user.coachSports.includes(tag) ? 'coach' : 'active'}`}
            >
              {tag}
            </span>
          ))}
        </div>
      </section>

      <section className="surface profile-block">
        <SectionTitle
          action={
            <Link to="/app/discover" className="section-action">
              Добавить
            </Link>
          }
        >
          Мои залы
        </SectionTitle>
        {gyms.length ? (
          <div className="chip-grid">
            {gyms.map((gym) => (
              <Link key={gym.id} to={`/app/gym/${gym.id}`} className="chip active">
                {gym.name}
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-copy-actions">
            <div className="empty-copy" role="status">
              <p className="empty-copy-title">Зал не выбран</p>
              <p className="empty-copy-lead">Выбери клуб в каталоге — без него не отметить присутствие</p>
            </div>
            <Link to="/app/discover" className="btn btn-primary btn-block">
              В каталог залов
            </Link>
          </div>
        )}
      </section>

      <section className="surface profile-block">
        <SectionTitle
          action={
            <button
              type="button"
              className="section-action"
              onClick={() => setScheduleOpen(true)}
            >
              Изменить
            </button>
          }
        >
          Расписание
        </SectionTitle>
        {onBreak ? (
          <p className="break-note">
            {breakText}. Чек-ин в зал снимет статус автоматически.
          </p>
        ) : null}
        {user.visitSlots.length ? (
          <div className="slots">
            {user.visitSlots.map((slot) => (
              <div key={`${slot.day}-${slot.from}-${slot.to}`} className="slot">
                <strong>{slot.day}</strong>
                <span>
                  {slot.from}–{slot.to}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-copy-actions">
            <div className="empty-copy" role="status">
              <p className="empty-copy-title">Расписание не задано</p>
              <p className="empty-copy-lead">Укажи дни и время — так проще пересечься в зале</p>
            </div>
            <button
              type="button"
              className="btn btn-soft btn-sm btn-block"
              onClick={() => setScheduleOpen(true)}
            >
              Указать расписание
            </button>
          </div>
        )}
      </section>

      <ScheduleSheet
        open={scheduleOpen}
        initialSlots={user.visitSlots}
        onClose={() => setScheduleOpen(false)}
        onSave={(visitSlots) => {
          void patch({ visitSlots })
        }}
      />

      <section className="surface profile-block status-panel">
        <SectionTitle>Общение и видимость</SectionTitle>
        <button
          type="button"
          className="toggle-row"
          role="switch"
          aria-checked={user.lookingToMeet}
          onClick={() => void patch({ lookingToMeet: !user.lookingToMeet })}
        >
          <div>
            <strong>Открыт к знакомству</strong>
            <p className="muted">Разрешить сообщения от других</p>
          </div>
          <span className={`toggle ${user.lookingToMeet ? 'on' : ''}`} />
        </button>
        <button
          type="button"
          className="toggle-row"
          role="switch"
          aria-checked={user.privacy === 'anonymous'}
          onClick={() =>
            void patch({ privacy: user.privacy === 'open' ? 'anonymous' : 'open' })
          }
        >
          <div>
            <strong>Анонимный режим</strong>
            <p className="muted">
              {user.privacy === 'anonymous'
                ? 'Информация в профиле скрыта'
                : 'Информация в профиле открыта'}
            </p>
          </div>
          <span className={`toggle ${user.privacy === 'anonymous' ? 'on' : ''}`} />
        </button>
      </section>

      <section className="surface profile-block profile-invite-block">
        <SectionTitle>Мой круг</SectionTitle>
        <p className="muted profile-invite-hint">
          {user.referralTitle
            ? `${user.referralTitle} · ${user.referralCreditedCount || 0} в круге — приглашай друзей и открывай статусы`
            : 'Приглашай друзей и открывай статусы на аватаре'}
        </p>
        <Link to="/app/invite" className="btn btn-soft btn-block">
          <Share2 size={16} /> Открыть мой круг
        </Link>
      </section>

      {user.isAdmin ? (
        <Link to="/app/admin" className="btn btn-ghost btn-block">
          <Shield size={16} /> Админка
        </Link>
      ) : null}

      <SoftFlash message={copyFlash} />
    </main>
  )
}
