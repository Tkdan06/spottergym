import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Dumbbell, Shield } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { LANDING } from '../content/landing'
import { captureMarketingParams, marketingRegisterSearch } from '../lib/utm'
import './LandingPage.css'

function registerPath() {
  return `/register${marketingRegisterSearch({ from: 'lp' })}`
}

function CtaPair({
  primaryLabel,
  secondaryLabel = LANDING.hero.ctaSecondary,
}: {
  primaryLabel: string
  secondaryLabel?: string
}) {
  return (
    <div className="lp-actions">
      <Link to={registerPath()} className="btn btn-primary btn-block">
        {primaryLabel}
        <ArrowRight size={18} aria-hidden />
      </Link>
      <Link to="/login" className="btn btn-ghost btn-block">
        {secondaryLabel}
      </Link>
    </div>
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
          <CtaPair primaryLabel={LANDING.hero.ctaPrimary} />

          <div className="lp-status-demo" aria-label="Примеры карточек в Spotter">
            <div className="lp-demo-card">
              <div className="lp-demo-row">
                <img
                  className="lp-demo-avatar"
                  src="/images/avatar-male.svg"
                  alt=""
                  width={48}
                  height={48}
                />
                <div className="lp-demo-copy">
                  <strong>Алекс, 27</strong>
                  <span className="muted">Твой клуб · жим / функционалка</span>
                </div>
              </div>
              <div className="lp-demo-pills">
                <span className="lp-pill lp-pill-on">В зале</span>
                <span className="lp-pill lp-pill-open">Открыт к общению</span>
              </div>
            </div>
            <div className="lp-demo-card lp-demo-card-coach">
              <div className="lp-demo-row">
                <img
                  className="lp-demo-avatar"
                  src="/images/avatar-female.svg"
                  alt=""
                  width={48}
                  height={48}
                />
                <div className="lp-demo-copy">
                  <strong>Катя, 31</strong>
                  <span className="muted">Твой клуб · силовой · стретчинг</span>
                </div>
              </div>
              <div className="lp-demo-pills">
                <span className="lp-pill lp-pill-coach">Тренер</span>
                <span className="lp-pill lp-pill-open">Открыт к общению</span>
              </div>
            </div>
          </div>
        </header>

        <section className="lp-section" aria-labelledby="lp-pains">
          <h2 id="lp-pains" className="lp-section-title">
            {LANDING.pains.title}
          </h2>
          <div className="lp-stack">
            {LANDING.pains.items.map((item) => (
              <article key={item.title} className="lp-block">
                <h3>{item.title}</h3>
                <p className="muted">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-section" aria-labelledby="lp-offer">
          <h2 id="lp-offer" className="lp-section-title">
            {LANDING.offer.title}
          </h2>
          <p className="lp-section-lead muted">{LANDING.offer.lead}</p>
          <div className="lp-stack">
            {LANDING.offer.items.map((item) => (
              <article key={item.title} className="lp-block lp-offer-item">
                <h3>{item.title}</h3>
                <p className="muted">{item.body}</p>
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

        <section className="lp-section" aria-labelledby="lp-statuses">
          <h2 id="lp-statuses" className="lp-section-title">
            {LANDING.statuses.title}
          </h2>
          <p className="lp-section-lead muted">{LANDING.statuses.lead}</p>
          <ul className="lp-status-list">
            {LANDING.statuses.items.map((item) => (
              <li key={item.label} className="lp-block">
                <strong>{item.label}</strong>
                <p className="muted">{item.hint}</p>
              </li>
            ))}
          </ul>
        </section>

        <ScenarioCarousel />

        <section className="lp-mid-cta" aria-labelledby="lp-mid">
          <h2 id="lp-mid" className="lp-section-title">
            {LANDING.midCta.title}
          </h2>
          <p className="lp-section-lead muted">{LANDING.midCta.lead}</p>
          <CtaPair
            primaryLabel={LANDING.midCta.ctaPrimary}
            secondaryLabel={LANDING.midCta.ctaSecondary}
          />
        </section>

        <section className="lp-section lp-coaches" aria-labelledby="lp-coaches">
          <div
            className="lp-coaches-visual"
            style={{ backgroundImage: `url(${LANDING.coaches.image})` }}
            role="img"
            aria-label="Тренер работает с клиентом в зале"
          />
          <h2 id="lp-coaches" className="lp-section-title">
            <Dumbbell size={20} aria-hidden /> {LANDING.coaches.title}
          </h2>
          <p className="lp-section-lead muted">{LANDING.coaches.lead}</p>
          <div className="lp-coach-grid">
            <article className="lp-block">
              <h3>{LANDING.coaches.forCoaches.title}</h3>
              <ul className="lp-mini-list">
                {LANDING.coaches.forCoaches.items.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </article>
            <article className="lp-block">
              <h3>{LANDING.coaches.forClients.title}</h3>
              <ul className="lp-mini-list">
                {LANDING.coaches.forClients.items.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section className="lp-section" aria-labelledby="lp-safety">
          <h2 id="lp-safety" className="lp-section-title">
            <Shield size={20} aria-hidden /> {LANDING.safety.title}
          </h2>
          <ul className="lp-check-list">
            {LANDING.safety.items.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>

        <section className="lp-final" aria-labelledby="lp-final">
          <h2 id="lp-final" className="lp-section-title">
            {LANDING.finalCta.title}
          </h2>
          <p className="lp-section-lead muted">{LANDING.finalCta.lead}</p>
          <CtaPair
            primaryLabel={LANDING.finalCta.ctaPrimary}
            secondaryLabel={LANDING.finalCta.ctaSecondary}
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
