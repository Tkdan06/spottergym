import { Link, Navigate, useParams } from 'react-router-dom'
import {
  WORKOUTS_ARTICLES,
  WORKOUTS_HUB,
  WORKOUTS_HUB_PATH,
  type WorkoutsCtaTarget,
  type WorkoutsVisualKind,
  workoutsArticleBySlug,
  workoutsRelated,
} from '../content/workoutsGuide'
import { useApp } from '../context/useApp'
import { registerHref } from '../lib/inviteShare'
import { trackLanding } from '../lib/landingTrack'
import { GuideBreadcrumbs, GuideFooter, GuideParagraphs } from './guideBlocks'
import './AuthPages.css'
import './GuidePage.css'

function productHref(loggedIn: boolean, target: WorkoutsCtaTarget) {
  if (!loggedIn) return registerHref()
  if (target === 'progress') return '/app/workouts/progress'
  if (target === 'activity') return '/app/activity'
  if (target === 'discover') return '/app/discover'
  return '/app/workouts'
}

function HubCta({
  label,
  placement,
  target = 'workouts',
}: {
  label: string
  placement: string
  target?: WorkoutsCtaTarget
}) {
  const { user } = useApp()
  return (
    <Link
      to={productHref(Boolean(user), target)}
      className="btn btn-primary btn-block"
      onClick={() => trackLanding('cta_register', { placement })}
    >
      {label}
    </Link>
  )
}

function GuideBrand() {
  return (
    <Link to="/" className="brand-mark auth-brand">
      SPOT<span>TER</span>
    </Link>
  )
}

function WorkoutsVisual({ kind }: { kind: WorkoutsVisualKind }) {
  if (kind === 'diary' || kind === 'hub') {
    return (
      <figure className="guide-visual" aria-label="Дневник тренировок Spotter с упражнениями, весом и количеством повторений">
        <div className="gv-diary">
          <div className="gv-diary-head">
            <strong>Жим + спина</strong>
            <span>вт, 12 мар</span>
          </div>
          <ul>
            <li>
              <span>Жим лёжа</span>
              <b>90 кг × 8</b>
            </li>
            <li>
              <span>Тяга штанги</span>
              <b>70 кг × 10</b>
            </li>
            <li>
              <span>Подтягивания</span>
              <b>8, 7, 6</b>
            </li>
          </ul>
        </div>
        {kind === 'hub' ? (
          <div className="gv-hub-spark" aria-hidden="true">
            <svg viewBox="0 0 160 56" width="160" height="56">
              <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                points="4,44 28,40 52,36 76,28 100,24 124,14 156,10"
              />
            </svg>
            <span>90 кг</span>
          </div>
        ) : null}
      </figure>
    )
  }

  if (kind === 'progress') {
    return (
      <figure className="guide-visual" aria-label="График прогресса упражнения в Spotter: даты, рабочий вес и повторения за выбранный период">
        <div className="gv-progress">
          <div className="gv-pills" aria-hidden="true">
            <span>7д</span>
            <span className="is-on">30д</span>
            <span>90д</span>
            <span>180д</span>
            <span>365д</span>
          </div>
          <p className="gv-lift">Жим лёжа</p>
          <div className="gv-hero">
            <b>90 кг</b>
            <span>+7,5 кг за период</span>
          </div>
          <svg viewBox="0 0 280 88" className="gv-chart" aria-hidden="true">
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinejoin="round"
              points="8,70 56,62 104,58 152,40 200,32 272,18"
            />
            <circle cx="272" cy="18" r="4.5" fill="currentColor" />
          </svg>
          <p className="gv-meta">12 фев · 80 кг · 8 повт. → 12 мар · 90 кг · 8 повт.</p>
        </div>
      </figure>
    )
  }

  if (kind === 'plateau') {
    return (
      <figure className="guide-visual" aria-label="График упражнения с остановившейся динамикой рабочего веса">
        <div className="gv-progress gv-progress--flat">
          <p className="gv-lift">Жим лёжа</p>
          <p className="gv-stat">Похоже, ты застрял</p>
          <svg viewBox="0 0 280 72" className="gv-chart" aria-hidden="true">
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              points="8,28 60,24 110,26 160,25 210,27 272,26"
            />
          </svg>
          <p className="gv-meta">Несколько недель на 80 кг × 8 — без сдвига в рабочих подходах</p>
        </div>
      </figure>
    )
  }

  if (kind === 'activity') {
    return (
      <figure className="guide-visual" aria-label="Отметка «Я в зале» и график времени пребывания в клубе">
        <div className="gv-activity">
          <div className="gv-checkin">Я в зале</div>
          <p className="gv-meta">Активность идёт от этой кнопки, а не от записи подходов</p>
          <div className="gv-bars" aria-hidden="true">
            <span style={{ height: '40%' }} />
            <span style={{ height: '70%' }} />
            <span style={{ height: '18%' }} />
            <span style={{ height: '88%' }} />
            <span style={{ height: '55%' }} />
            <span style={{ height: '30%' }} />
            <span style={{ height: '62%' }} />
          </div>
        </div>
      </figure>
    )
  }

  if (kind === 'partner') {
    return (
      <figure className="guide-visual" aria-label="Карточка человека из своего клуба со статусом «В зале»">
        <div className="gv-partner">
          <div className="gv-avatar" aria-hidden="true" />
          <div>
            <strong>Алексей</strong>
            <p>Spirit. Fitness · силовая</p>
            <div className="gv-tags">
              <span>В зале</span>
              <span className="is-quiet">Открыт к знакомству</span>
            </div>
          </div>
        </div>
      </figure>
    )
  }

  return (
    <figure className="guide-visual" aria-label="Разбор истории тренировок: упражнения с ростом и упражнения без динамики">
      <div className="gv-analysis">
        <p className="gv-stat">Ты стал сильнее в 4 упражнениях</p>
        <ul>
          <li>
            <span>Жим лёжа</span>
            <b>+12,5%</b>
          </li>
          <li>
            <span>Тяга штанги</span>
            <b>+8%</b>
          </li>
          <li className="is-flat">
            <span>Приседания</span>
            <b>без прогресса</b>
          </li>
        </ul>
      </div>
    </figure>
  )
}

export function WorkoutsGuideHubPage() {
  return (
    <div className="app-shell">
      <main className="page no-nav guide-page guide-hub">
        <GuideBrand />
        <GuideBreadcrumbs
          items={[
            { to: '/', label: 'Главная' },
            { to: '/guide', label: 'Журнал' },
            { to: WORKOUTS_HUB_PATH, label: 'Тренировки' },
          ]}
        />

        <header className="guide-head guide-hub-hero">
          <p className="guide-kicker">{WORKOUTS_HUB.kicker}</p>
          <h1>{WORKOUTS_HUB.h1}</h1>
          <p className="muted guide-lead">{WORKOUTS_HUB.lead}</p>
          <WorkoutsVisual kind="hub" />
          <HubCta label={WORKOUTS_HUB.ctaLabel} placement="guide_workouts_hub" />
        </header>

        <section className="guide-block" aria-labelledby="workouts-start">
          <h2 id="workouts-start">С чего начать</h2>
          <ul className="guide-start">
            {WORKOUTS_HUB.start.map((card, i) => {
              const article = workoutsArticleBySlug(card.slug)
              if (!article) return null
              return (
                <li key={card.slug} className={`guide-start-card is-${i}`}>
                  <WorkoutsVisual kind={article.visual} />
                  <div className="guide-start-copy">
                    <h3>{card.title}</h3>
                    <p className="muted">{card.lead}</p>
                    <Link to={article.path} className="btn btn-soft">
                      Читать статью
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="guide-block" aria-labelledby="workouts-all">
          <h2 id="workouts-all">Все материалы о тренировках</h2>
          <ul className="guide-catalog">
            {WORKOUTS_ARTICLES.map((article, i) => (
              <li key={article.slug}>
                <Link to={article.path} className={`guide-catalog-card is-${i}`}>
                  <span className="guide-card-kicker">{article.kicker}</span>
                  <h3>{article.cardTitle}</h3>
                  <p className="muted">{article.cardLead}</p>
                  <span className="guide-catalog-accent" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="guide-block" aria-labelledby="workouts-flow">
          <h2 id="workouts-flow">От первой записи до понятного прогресса</h2>
          <ol className="guide-timeline">
            {WORKOUTS_HUB.timeline.map((step, i) => (
              <li key={step}>
                <span className="guide-timeline-n">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="guide-cta-band">
          <h2>{WORKOUTS_HUB.bottomTitle}</h2>
          <p className="muted">{WORKOUTS_HUB.bottomLead}</p>
          <HubCta label={WORKOUTS_HUB.bottomCta} placement="guide_workouts_hub_bottom" />
        </section>

        <GuideFooter cta={null} />
      </main>
    </div>
  )
}

export function WorkoutsGuideArticlePage() {
  const { article: slug } = useParams()
  const article = workoutsArticleBySlug(slug)
  if (!article) return <Navigate to={WORKOUTS_HUB_PATH} replace />

  const related = workoutsRelated(article)

  return (
    <div className="app-shell" key={article.slug}>
      <main className="page no-nav guide-page">
        <GuideBrand />
        <GuideBreadcrumbs
          items={[
            { to: '/', label: 'Главная' },
            { to: '/guide', label: 'Журнал' },
            { to: WORKOUTS_HUB_PATH, label: 'Тренировки' },
            { to: article.path, label: article.crumb },
          ]}
        />
        <article className="guide-article">
          <header className="guide-head">
            <p className="guide-kicker">{article.kicker}</p>
            <h1>{article.h1}</h1>
            {article.lead.map((p) => (
              <p key={p} className="guide-lead">
                {p}
              </p>
            ))}
          </header>
          <WorkoutsVisual kind={article.visual} />
          {article.sections.map((section, i) => (
            <section key={section.heading} className="guide-section">
              <h2>{section.heading}</h2>
              <GuideParagraphs texts={section.body} />
              {i + 1 === article.inlineAfter ? <WorkoutsVisual kind={article.inlineVisual} /> : null}
            </section>
          ))}
        </article>

        <section className="guide-block" aria-labelledby="workouts-related">
          <h2 id="workouts-related">Читайте также</h2>
          <ul className="guide-related">
            {related.map((item) => (
              <li key={item.slug}>
                <Link to={item.path}>{item.anchorTitle}</Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="guide-cta-band">
          <HubCta
            label={article.ctaLabel}
            placement={`guide_workouts_${article.slug}`}
            target={article.ctaTarget}
          />
        </section>

        <GuideFooter cta={null} />
      </main>
    </div>
  )
}
