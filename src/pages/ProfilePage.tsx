import { useState } from 'react'
import { Bell, Copy, Eye, EyeOff, MessageSquareText, Settings, Share2, Shield } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { CheckInControl } from '../components/CheckInControl'
import { InviteFriendsButton } from '../components/InviteFriendsButton'
import { LikesRow } from '../components/LikesRow'
import { PhotoGalleryModal } from '../components/PhotoGalleryModal'
import { ProfilePhotoCarousel } from '../components/ProfilePhotoCarousel'
import { ScheduleSheet } from '../components/ScheduleSheet'
import { SectionTitle } from '../components/SectionTitle'
import { useApp } from '../context/useApp'
import { experienceLabel, getGym, getUserGyms, intentLabel } from '../data/mock'
import { profileImage } from '../lib/avatar'
import { clampPhotos } from '../lib/photos'
import { getCheckedInGymId } from '../lib/presence'
import { breakLabel, isOnBreak } from '../lib/schedule'
import { formatUsername } from '../lib/username'
import './ProfileViews.css'

export function ProfilePage() {
  const { user, updateProfile, getLikesFor, getMyLikedUsers, unreadNotifications } = useApp()
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  if (!user) return <Navigate to="/login" replace />
  const gyms = getUserGyms(user)
  const likesInfo = getLikesFor(user.id)
  const myLiked = getMyLikedUsers()
  const checkedGym = getGym(getCheckedInGymId(user))
  const photoCount = user.photos.length
  const heroSrc = profileImage(user)
  const onBreak = isOnBreak(user.breakUntil)
  const breakText = breakLabel(user.breakUntil)

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

      <div className="profile-hero mine">
        <ProfilePhotoCarousel
          photos={user.photos}
          fallbackSrc={heroSrc}
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
          <h1>
            {user.name}, {user.age}
          </h1>
          {user.username ? (
            <button
              type="button"
              className="profile-username"
              onClick={() => {
                void navigator.clipboard?.writeText(formatUsername(user.username)).catch(() => undefined)
              }}
              title="Скопировать @ник"
            >
              {formatUsername(user.username)}
              <Copy size={14} aria-hidden />
            </button>
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
        name={user.name}
        editable
        initialIndex={galleryIndex}
        onChangePhotos={(photos) => updateProfile({ photos: clampPhotos(photos) })}
      />

      <section className="surface profile-block">
        <SectionTitle>Пригласить друзей</SectionTitle>
        <InviteFriendsButton userId={user.id} className="btn btn-primary btn-block">
          <Share2 size={16} /> Поделиться ссылкой
        </InviteFriendsButton>
      </section>

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
        <SectionTitle
          action={
            <Link to="/app/discover" className="muted">
              Добавить
            </Link>
          }
        >
          Мои залы
        </SectionTitle>
        <div className="chip-grid">
          {gyms.length ? (
            gyms.map((gym) => (
              <Link key={gym.id} to={`/app/gym/${gym.id}`} className="chip active">
                {gym.name}
              </Link>
            ))
          ) : (
            <p className="muted">Пока нет залов — выбери в каталоге</p>
          )}
        </div>
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
          onClick={() => updateProfile({ lookingToMeet: !user.lookingToMeet })}
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
          onClick={() =>
            updateProfile({
              isCoach: !user.isCoach,
              coachSports: !user.isCoach
                ? user.coachSports.length
                  ? user.coachSports
                  : user.sports.slice(0, 2)
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
                  : 'Метка «Тренер» видна в зале'
                : 'Показать на карточке, что ты тренер'}
            </p>
          </div>
          <span className={`toggle ${user.isCoach ? 'on' : ''}`} />
        </button>
        <button
          type="button"
          className="toggle-row"
          onClick={() =>
            updateProfile({ privacy: user.privacy === 'open' ? 'anonymous' : 'open' })
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
        <SectionTitle>О себе</SectionTitle>
        <p>{user.bio || 'Добавь описание — так проще начать разговор'}</p>
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
        <div className="slots">
          {user.visitSlots.length ? (
            user.visitSlots.map((slot) => (
              <div key={`${slot.day}-${slot.from}-${slot.to}`} className="slot">
                <strong>{slot.day}</strong>
                <span>
                  {slot.from}–{slot.to}
                </span>
              </div>
            ))
          ) : (
            <p className="muted">
              Не задано —{' '}
              <button type="button" className="text-link" onClick={() => setScheduleOpen(true)}>
                укажи дни и время
              </button>
            </p>
          )}
        </div>
      </section>

      <ScheduleSheet
        open={scheduleOpen}
        initialSlots={user.visitSlots}
        onClose={() => setScheduleOpen(false)}
        onSave={(visitSlots) => updateProfile({ visitSlots })}
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

      <Link to="/app/settings" className="btn btn-ghost btn-block">
        Редактировать профиль
      </Link>
    </main>
  )
}
