import { useEffect } from 'react'
import { ArrowRight, Dumbbell, Heart, MessageCircle } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { LANDING_COACHES, type LandingDemoProfile } from '../content/landing'
import {
  attachLandingScrollTracking,
  trackLanding,
} from '../lib/landingTrack'
import { captureMarketingParams, marketingRegisterSearch } from '../lib/utm'
import './LandingPage.css'

const FROM = 'lp-coaches'

function registerPath() {
  return `/register${marketingRegisterSearch({ from: FROM })}`
}

function loginPath() {
  return `/login${marketingRegisterSearch({ from: FROM })}`
}

function CtaPair({
  primaryLabel,
  secondaryLabel = LANDING_COACHES.hero.ctaSecondary,
  placement,
}: {
  primaryLabel: string
  secondaryLabel?: string
  placement: 'hero' | 'mid' | 'final'
}) {
  return (
    <div className={`lp-actions${placement === 'hero' ? ' lp-actions-hero' : ''}`}>
      <Link
        to={registerPath()}
        className="btn btn-primary btn-block"
        onClick={() => trackLanding('cta_register', { placement: `${FROM}:${placement}` })}
      >
        {primaryLabel}
        <ArrowRight size={18} aria-hidden />
      </Link>
      {placement === 'final' ? (
        <Link
          to={loginPath()}
          className="lp-login-quiet"
          onClick={() => trackLanding('cta_login', { placement: `${FROM}:${placement}` })}
        >
          {secondaryLabel}
        </Link>
      ) : null}
    </div>
  )
}

function DemoProfileCard({ profile }: { profile: LandingDemoProfile }) {
  return (
    <Link
      to={registerPath()}
      className={`lp-demo-card${profile.isCoach ? ' lp-demo-card-coach' : ''}`}
      onClick={() =>
        trackLanding('cta_register', { placement: `${FROM}:demo:${profile.id}` })
      }
      aria-label={`${profile.name}, ${profile.age}. ${profile.gym}`}
    >
      <div className="lp-demo-aside">
        <div className="lp-demo-media">
          <img src={profile.photo} alt="" width={88} height={88} />
        </div>
        <span className={`lp-demo-presence ${profile.inGym ? 'on' : 'off'}`}>
          <i aria-hidden />
          {profile.inGym ? 'В зале' : 'Не в зале'}
        </span>
      </div>
      <div className="lp-demo-body">
        <h3>
          {profile.name}
          <span className="lp-demo-age">, {profile.age}</span>
        </h3>
        <p className="lp-demo-gym">{profile.gym}</p>
        <p className="muted lp-demo-line">{profile.line}</p>
        <div className="lp-demo-pills">
          {profile.isCoach ? <span className="lp-pill lp-pill-coach">Тренер</span> : null}
          {profile.open ? (
            <span className="lp-pill lp-pill-open">Открыт к общению</span>
          ) : null}
        </div>
        <div className="lp-demo-meta">
          <div className="lp-demo-likes" aria-label={`${profile.likeCount} лайков`}>
            <div className="lp-demo-likers" aria-hidden>
              {profile.likerPhotos.map((src) => (
                <img key={src} src={src} alt="" className="lp-demo-liker" width={22} height={22} />
              ))}
              {profile.likeCount > profile.likerPhotos.length ? (
                <span className="lp-demo-likes-extra">
                  +{profile.likeCount - profile.likerPhotos.length}
                </span>
              ) : null}
            </div>
            <span className="lp-demo-likes-count">
              <Heart size={12} fill="currentColor" aria-hidden />
              {profile.likeCount}
            </span>
          </div>
          <span className="lp-demo-msg" aria-hidden>
            <MessageCircle size={16} />
          </span>
        </div>
      </div>
    </Link>
  )
}

export function LandingCoachesPage() {
  const { search } = useLocation()

  useEffect(() => {
    captureMarketingParams(search)
    captureMarketingParams(`from=${FROM}`)
    return attachLandingScrollTracking()
  }, [search])

  return (
    <div className="app-shell">
      <main className="page no-nav lp">
        <header className="lp-hero">
          <div className="lp-hero-bg" aria-hidden />
          <p className="lp-kicker">{LANDING_COACHES.hero.kicker}</p>
          <p className="brand-mark lp-brand" aria-label="Spotter">
            SPOT<span>TER</span>
          </p>
          <h1 className="lp-headline">{LANDING_COACHES.hero.headline}</h1>
          <p className="lp-lead">{LANDING_COACHES.hero.lead}</p>
          <CtaPair primaryLabel={LANDING_COACHES.hero.ctaPrimary} placement="hero" />

          <div className="lp-status-demo" aria-label="Пример профиля тренера">
            <p className="lp-demo-caption muted">Так видят тебя в клубе</p>
            {LANDING_COACHES.demoProfiles.map((profile) => (
              <DemoProfileCard key={profile.id} profile={profile} />
            ))}
          </div>
        </header>

        <section className="lp-section lp-coaches" aria-labelledby="lp-coach-value">
          <h2 id="lp-coach-value" className="lp-section-title">
            <Dumbbell size={20} aria-hidden /> {LANDING_COACHES.value.title}
          </h2>
          <div
            className="lp-coaches-visual"
            style={{ backgroundImage: `url(${LANDING_COACHES.image})` }}
            role="img"
            aria-label="Тренер работает с клиентом в зале"
          />
          <p className="lp-section-lead muted">{LANDING_COACHES.value.lead}</p>
          <div className="lp-stack">
            {LANDING_COACHES.value.items.map((item) => (
              <article key={item.title} className="lp-block">
                <h3>{item.title}</h3>
                <p className="muted">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-section" aria-labelledby="lp-for-coaches">
          <article className="lp-block">
            <h3 id="lp-for-coaches">{LANDING_COACHES.forCoaches.title}</h3>
            <ul className="lp-mini-list">
              {LANDING_COACHES.forCoaches.items.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </article>
        </section>

        <section className="lp-section" aria-labelledby="lp-coach-steps">
          <h2 id="lp-coach-steps" className="lp-section-title">
            {LANDING_COACHES.steps.title}
          </h2>
          <ol className="lp-steps">
            {LANDING_COACHES.steps.items.map((item) => (
              <li key={item.step} className="lp-block lp-step">
                <span className="lp-step-num" aria-hidden>
                  {item.step}
                </span>
                <div>
                  <h3>{item.title}</h3>
                  <p className="muted">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="lp-final" aria-labelledby="lp-coach-final">
          <h2 id="lp-coach-final" className="lp-section-title">
            {LANDING_COACHES.finalCta.title}
          </h2>
          <p className="lp-section-lead muted">{LANDING_COACHES.finalCta.lead}</p>
          <CtaPair
            primaryLabel={LANDING_COACHES.finalCta.ctaPrimary}
            secondaryLabel={LANDING_COACHES.finalCta.ctaSecondary}
            placement="final"
          />
        </section>

        <footer className="lp-footer">
          <p>© {new Date().getFullYear()} Spotter. Все права защищены.</p>
          <p>
            <a href="mailto:info@spottergym.ru">info@spottergym.ru</a>
            {' · '}
            <Link to="/terms?from=lp-coaches">Пользовательское соглашение</Link>
            {' · '}
            <Link to="/guide">Как это работает</Link>
            {' · '}
            <Link to="/lp">Основной лендинг</Link>
          </p>
        </footer>
      </main>
    </div>
  )
}
