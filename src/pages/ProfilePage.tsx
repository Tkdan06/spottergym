import { useState } from 'react'
import { Bell, ChartNoAxesColumn, Copy, Eye, EyeOff, MessageSquareText, Settings, Share2, Shield } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { CheckInControl } from '../components/CheckInControl'
import { LikesRow } from '../components/LikesRow'
import { ReferralBadge, referralChromeClass } from '../components/ReferralBadge'
import { PhotoGalleryModal } from '../components/PhotoGalleryModal'
import { ProfilePhotoCarousel } from '../components/ProfilePhotoCarousel'
import { ScheduleSheet } from '../components/ScheduleSheet'
import { SectionTitle } from '../components/SectionTitle'
import { useApp } from '../context/useApp'
import { COACH_DIRECTIONS, experienceLabel, getGym, getUserGyms, intentLabel } from '../data/mock'
import { isDemoAccount } from '../lib/demoAccount'
import { localGenderAvatar, profileImage } from '../lib/avatar'
import { clampPhotos } from '../lib/photos'
import { getCheckedInGymId } from '../lib/presence'
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
  const checkedGym = getGym(getCheckedInGymId(user))
  const photoCount = user.photos.length
  const heroSrc = profileImage(user)
  const onBreak = isOnBreak(user.breakUntil)
  const breakText = breakLabel(user.breakUntil)

  const patch = (data: Parameters<typeof updateProfile>[0]) => {
    setSaveError('')
    return Promise.resolve(updateProfile(data)).catch((err: unknown) => {
      setSaveError(err instanceof Error ? err.message : 'Не удалось сохранить')
    })
  }

  return (
    <main className="page profile-view">
      <header className="page-header profile-top">
        <div className="page-header-text">
          <h1 className="page-title">Профиль</h1>
        </div>
        <div className="page-header-actions profile-top-actions">
          <Link to="/app/activity" className="icon-btn" aria-label="Активность" title="Активность">
            <ChartNoAxesColumn size={20} />
          </Link>
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
        <div className="profile-hero-meta">
          {onBreak ? <span className="pill pill-break">{breakText}</span> : null}
          <h2 className="profile-hero-name">
            {user.name}, {user.age}
          </h2>
          <ReferralBadge user={user} size="md" showTitle />
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
          {copyFlash ? (
            <p className="dim profile-copy-flash" role="status" aria-live="polite">
              {copyFlash}
            </p>
          ) : null}
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
            <Link to="/app/likes/sent" className="muted">
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
            <Link to="/app/settings" className="btn btn-soft btn-block">
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
            <Link to="/app/discover" className="muted">
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

      <section className="surface profile-block status-panel">
        <div className="checkin-block">
          <div>
            <strong>
              {user.isActive
                ? checkedGym
                  ? `Ты в зале · ${checkedGym.name.replace(/^(DDX|Spirit\. Fitness|World Class|Encore|Crocus Fitness|XFIT|Alex Fitness)\s*/i, '')}`
                  : 'Ты сейчас в зале'
                : 'Отметиться в зале'}
            </strong>
            <p className="muted">
              {gyms.length > 1
                ? 'Если залов несколько — выбери, где ты сейчас'
                : 'Статус «на тренировке» виден участникам клуба'}
            </p>
          </div>
          <CheckInControl preferredGymId={user.homeGymId} />
        </div>
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
          aria-checked={user.isCoach}
          onClick={() =>
            void patch({
              isCoach: !user.isCoach,
              coachSports: !user.isCoach
                ? user.coachSports.length
                  ? user.coachSports
                  : COACH_DIRECTIONS.filter((d) => user.sports.includes(d)).slice(0, 2)
                : [],
            })
          }
        >
          <div>
            <strong>Я тренер</strong>
            <p className="muted">
              {user.isCoach
                ? user.coachSports.length
                  ? `Направления: ${user.coachSports.join(', ')}`
                  : 'Укажи направления в настройках'
                : 'Показать на карточке, что ты тренер'}
            </p>
          </div>
          <span className={`toggle ${user.isCoach ? 'on' : ''}`} />
        </button>
        {user.isCoach && !user.coachSports.length ? (
          <Link to="/app/settings" className="muted profile-coach-hint">
            Выбрать направления тренера →
          </Link>
        ) : null}
        <button
          type="button"
          className="toggle-row"
          role="switch"
          aria-checked={user.privacy === 'anonymous'}
          onClick={() =>
            void patch({ privacy: user.privacy === 'open' ? 'anonymous' : 'open' })
          }
        >
          <div className="row">
            {user.privacy === 'open' ? <Eye size={18} /> : <EyeOff size={18} />}
            <div>
              <strong>{user.privacy === 'open' ? 'Открытый профиль' : 'Анонимный режим'}</strong>
              <p className="muted">
                {user.privacy === 'open'
                  ? 'Имя и фото видны'
                  : 'Видна только заглушка до твоего решения'}
              </p>
            </div>
          </div>
          <span className={`toggle ${user.privacy === 'anonymous' ? 'on' : ''}`} />
        </button>
      </section>

      <section className="surface profile-block">
        <SectionTitle
          action={
            <button type="button" className="text-link muted" onClick={() => setScheduleOpen(true)}>
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
              className="btn btn-soft btn-block"
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

      <section className="surface profile-block">
        <SectionTitle>Обратная связь</SectionTitle>
        <div className="chip-grid">
          <Link to="/app/feedback" className="chip active">
            <MessageSquareText size={14} /> Мои обращения
          </Link>
          {user.isAdmin ? (
            <Link to="/app/admin" className="chip coach">
              <Shield size={14} /> Админка
            </Link>
          ) : null}
        </div>
      </section>

      <section className="surface profile-block profile-invite-block">
        <SectionTitle>Круг Spotter</SectionTitle>
        <p className="muted profile-invite-hint">
          {user.referralTitle
            ? `${user.referralTitle} · ${user.referralCreditedCount || 0} в круге — приглашай друзей и открывай статусы`
            : 'Приглашай друзей из зала и открывай статусы на аватаре'}
        </p>
        <Link to="/app/invite" className="btn btn-ghost btn-block">
          <Share2 size={16} /> Открыть круг и ссылку
        </Link>
      </section>

      <Link to="/app/settings" className="btn btn-ghost btn-block">
        Редактировать профиль
      </Link>
    </main>
  )
}
