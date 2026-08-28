import { Link, Navigate, useParams } from 'react-router-dom'
import { GUIDE_INDEX_LEAD, guideBySlug, guideIndexCards } from '../content/guides'
import { GuideBreadcrumbs, GuideFooter, GuideParagraphs } from './guideBlocks'
import './AuthPages.css'
import './GuidePage.css'

export function GuideIndexPage() {
  return (
    <div className="app-shell">
      <main className="page no-nav guide-page">
        <Link to="/" className="brand-mark auth-brand">
          SPOT<span>TER</span>
        </Link>
        <GuideBreadcrumbs
          items={[
            { to: '/', label: 'Главная' },
            { to: '/guide', label: 'Журнал' },
          ]}
        />
        <p className="guide-kicker">Гид</p>
        <h1>Как устроен Spotter</h1>
        <p className="muted guide-lead">{GUIDE_INDEX_LEAD}</p>
        <ul className="guide-list">
          {guideIndexCards().map((card) => (
            <li key={card.path}>
              <Link to={card.path} className="guide-card">
                <span className="guide-card-kicker">{card.kicker}</span>
                <h2>{card.title}</h2>
                <span className="muted">{card.preview}</span>
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
        <GuideBreadcrumbs
          items={[
            { to: '/', label: 'Главная' },
            { to: '/guide', label: 'Журнал' },
            { to: article.path, label: article.kicker },
          ]}
        />
        <article className="guide-article">
          <header className="guide-head">
            <p className="guide-kicker">{article.kicker}</p>
            <h1>{article.title}</h1>
            {(Array.isArray(article.lead) ? article.lead : [article.lead]).map((p) => (
              <p key={p} className="guide-lead">
                {p}
              </p>
            ))}
          </header>
          {article.sections.map((section) => (
            <section key={section.heading} className="guide-section">
              <h2>{section.heading}</h2>
              <GuideParagraphs texts={section.body} />
            </section>
          ))}
        </article>
        <GuideFooter />
      </main>
    </div>
  )
}
