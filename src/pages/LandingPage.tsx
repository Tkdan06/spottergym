import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Heart, MessageCircle } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { LANDING, type LandingDemoProfile } from '../content/landing'
import {
  attachLandingScrollTracking,
  trackLanding,
} from '../lib/landingTrack'
import { captureMarketingParams, marketingRegisterSearch } from '../lib/utm'
import './LandingPage.css'

function registerPath() {
  return `/register${marketingRegisterSearch({ from: 'lp' })}`
}

function loginPath() {
  return `/login${marketingRegisterSearch({ from: 'lp' })}`
}

function CtaPair({
  primaryLabel,
  secondaryLabel = LANDING.hero.ctaSecondary,
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
        onClick={() => trackLanding('cta_register', { placement })}
      >
        {primaryLabel}
        <ArrowRight size={18} aria-hidden />
      </Link>
      <Link
        to={loginPath()}
        className="lp-login-quiet"
        onClick={() => trackLanding('cta_login', { placement })}
      >
        {secondaryLabel}
      </Link>
    </div>
  )
}

function DemoProfileCard({ profile }: { profile: LandingDemoProfile }) {
  return (
    <Link
      to={registerPath()}
      className={`lp-demo-card${profile.isCoach ? ' lp-demo-card-coach' : ''}`}
      onClick={() =>
        trackLanding('cta_register', { placement: `demo_profile:${profile.id}` })
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

function ScenarioCarousel() {
  const trackRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const items = LANDING.scenarios.items

  useEffect(() => {
    const el = trackRef.current
    if (!el) return

    const onScroll = () => {
      const cards = Array.from(el.querySelectorAll<HTMLElement>('[data-slide]'))
      if (!cards.length) return
      const mid = el.scrollLeft + el.clientWidth / 2
      let best = 0
      let bestDist = Infinity
      cards.forEach((card, i) => {
        const center = card.offsetLeft + card.offsetWidth / 2
        const dist = Math.abs(center - mid)
        if (dist < bestDist) {
          bestDist = dist
          best = i
        }
      })
      setActive(best)
    }

    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  const goTo = (index: number) => {
    const el = trackRef.current
    const card = el?.querySelectorAll<HTMLElement>('[data-slide]')[index]
    if (!el || !card) return
    setActive(index)
    const elRect = el.getBoundingClientRect()
    const cardRect = card.getBoundingClientRect()
    const left =
      el.scrollLeft + (cardRect.left - elRect.left) - (el.clientWidth - card.offsetWidth) / 2
    el.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
  }

  return (
    <section className="lp-section lp-scenarios" aria-labelledby="lp-scenarios">
      <h2 id="lp-scenarios" className="lp-section-title">
        {LANDING.scenarios.title}
      </h2>

      <div
        ref={trackRef}
        className="lp-carousel"
        role="region"
        aria-roledescription="карусель"
        aria-label={LANDING.scenarios.title}
      >
        {items.map((item, index) => (
          <article
            key={item.id}
            data-slide
            className={`lp-slide${index === active ? ' is-active' : ''}`}
            aria-label={`${index + 1} из ${items.length}: ${item.title}`}
          >
            <div
              className="lp-slide-media"
              style={{ backgroundImage: `url(${item.image})` }}
              role="img"
              aria-label={item.title}
            />
            <div className="lp-slide-body">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="lp-carousel-dots" role="tablist" aria-label="Сценарии">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={index === active}
            aria-label={item.title}
            className={index === active ? 'on' : undefined}
            onClick={() => goTo(index)}
          />
        ))}
      </div>
    </section>
  )
}

export function LandingPage() {
  const { search } = useLocation()

  useEffect(() => {
    captureMarketingParams(search)
    captureMarketingParams('from=lp')
    trackLanding('view', { path: '/lp' })
    return attachLandingScrollTracking()
  }, [search])

  useEffect(() => {
    const prev = document.title
    document.title = LANDING.metaTitle
    let meta = document.querySelector('meta[name="description"]')
    const prevDesc = meta?.getAttribute('content') ?? null
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'description')
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', LANDING.metaDescription)
    return () => {
      document.title = prev
      if (meta && prevDesc != null) meta.setAttribute('content', prevDesc)
    }
  }, [])

  return (
    <div className="app-shell">
      <main className="page no-nav lp">
        <header className="lp-hero">
          <div className="lp-hero-bg" aria-hidden />
          <p className="lp-kicker">{LANDING.hero.kicker}</p>
          <h1 className="brand-mark lp-brand" aria-label="Spotter">
            SPOT<span>TER</span>
          </h1>
          <p className="lp-headline">{LANDING.hero.headline}</p>
          <p className="lp-lead">{LANDING.hero.lead}</p>
          <CtaPair primaryLabel={LANDING.hero.ctaPrimary} placement="hero" />

          <div className="lp-status-demo" aria-label="Примеры профилей в Spotter">
            <p className="lp-demo-caption muted">{LANDING.hero.demoCaption}</p>
            {LANDING.demoProfiles.map((profile) => (
              <DemoProfileCard key={profile.id} profile={profile} />
            ))}
          </div>
        </header>

        <section className="lp-section" aria-labelledby="lp-pain-offer">
          <h2 id="lp-pain-offer" className="lp-section-title">
            {LANDING.painOffer.title}
          </h2>
          <p className="lp-section-lead muted">{LANDING.painOffer.lead}</p>
          <div className="lp-stack">
            {LANDING.painOffer.items.map((item) => (
              <article key={item.pain} className="lp-block lp-pain-offer">
                <p className="lp-pain">{item.pain}</p>
                <p className="lp-fix">
                  <span className="lp-fix-label">В Spotter</span>
                  {item.fix}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-section" aria-labelledby="lp-steps">
          <h2 id="lp-steps" className="lp-section-title">
            {LANDING.steps.title}
          </h2>
          <ol className="lp-steps">
            {LANDING.steps.items.map((item) => (
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

        <ScenarioCarousel />

        <section className="lp-final" aria-labelledby="lp-final">
          <h2 id="lp-final" className="lp-section-title">
            {LANDING.finalCta.title}
          </h2>
          <p className="lp-section-lead muted">{LANDING.finalCta.lead}</p>
          <CtaPair
            primaryLabel={LANDING.finalCta.ctaPrimary}
            secondaryLabel={LANDING.finalCta.ctaSecondary}
            placement="final"
          />
        </section>

        <footer className="lp-footer">
          <p>© {new Date().getFullYear()} Spotter. Все права защищены.</p>
          <p>
            <a href="mailto:info@spottergym.ru">info@spottergym.ru</a>
            {' · '}
            <Link to="/terms?from=lp">Пользовательское соглашение</Link>
          </p>
        </footer>
      </main>
    </div>
  )
}
