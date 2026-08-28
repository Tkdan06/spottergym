import { Link, Navigate, useParams } from 'react-router-dom'
import { GUIDE_ARTICLES, GUIDE_INDEX_LEAD, guideBySlug } from '../content/guides'
import { registerHref } from '../lib/inviteShare'
import { trackLanding } from '../lib/landingTrack'
import './AuthPages.css'
import './GuidePage.css'

function GuideFooter() {
  return (
    <footer className="guide-footer">
      <Link to={registerHref()} className="btn btn-primary btn-block" onClick={() => trackLanding('cta_register', { placement: 'guide' })}>
        Создать аккаунт
      </Link>
      <p className="muted">
        <Link to="/">На главную</Link>
        {' · '}
        <Link to="/guide">Все материалы</Link>
        {' · '}
        <Link to="/terms">Соглашение</Link>
      </p>
    </footer>
  )
}

export function GuideIndexPage() {
  return (
    <div className="app-shell">
      <main className="page no-nav guide-page">
        <Link to="/" className="brand-mark auth-brand">
          SPOT<span>TER</span>
        </Link>
        <p className="guide-kicker">Справка</p>
        <h1>Как устроен Spotter</h1>
        <p className="muted guide-lead">{GUIDE_INDEX_LEAD}</p>
        <ul className="guide-list">
          {GUIDE_ARTICLES.map((article) => (
            <li key={article.slug}>
              <Link to={article.path} className="guide-card">
                <span className="guide-card-kicker">{article.kicker}</span>
                <strong>{article.title}</strong>
                <span className="muted">{article.lead}</span>
              </Link>
            </li>
          ))}
        </ul>
        <GuideFooter />
      </main>
    </div>
  )
}

export function GuideArticlePage() {
  const { slug } = useParams()
  const article = guideBySlug(slug)
  if (!article) return <Navigate to="/guide" replace />

  return (
    <div className="app-shell">
      <main className="page no-nav guide-page">
        <Link to="/" className="brand-mark auth-brand">
          SPOT<span>TER</span>
        </Link>
        <p className="guide-kicker">{article.kicker}</p>
        <h1>{article.title}</h1>
        <p className="guide-lead">{article.lead}</p>
        {article.sections.map((section) => (
          <section key={section.heading} className="guide-section">
            <h2>{section.heading}</h2>
            {section.body.map((p) => (
              <p key={p.slice(0, 48)}>{p}</p>
            ))}
          </section>
        ))}
        <GuideFooter />
      </main>
    </div>
  )
}
