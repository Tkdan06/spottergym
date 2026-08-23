import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  TERMS_EFFECTIVE_DATE,
  TERMS_INTRO,
  TERMS_SECTIONS,
  TERMS_VERSION,
} from '../content/userAgreement'
import { registerHref } from '../lib/inviteShare'
import { markTermsAccepted } from '../lib/termsAcceptance'
import './TermsPage.css'

/** Titles in content include "1. …"; TOC keeps that number, headings show the name only. */
function sectionHeading(title: string) {
  return title.replace(/^\d+\.\s*/, '')
}

export function TermsPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const fromRegister = params.get('from') === 'register'

  const accept = () => {
    if (fromRegister) {
      markTermsAccepted()
      navigate(registerHref(), { replace: true, state: { termsAccepted: true } })
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <div className="app-shell">
      <main className="page no-nav terms-page">
        <Link to={fromRegister ? registerHref() : '/'} className="brand-mark auth-brand">
          SPOT<span>TER</span>
        </Link>

        <header className="terms-hero">
          <p className="terms-kicker">Правовая информация</p>
          <h1>{TERMS_INTRO.title}</h1>
          <p className="muted">
            Редакция {TERMS_VERSION} · действует с {TERMS_EFFECTIVE_DATE}
          </p>
          <p className="terms-lead">{TERMS_INTRO.lead}</p>
          <p className="terms-notice">{TERMS_INTRO.notice}</p>
        </header>

        <nav className="terms-toc" aria-label="Содержание">
          <p className="terms-toc-title">Содержание</p>
          <ul>
            {TERMS_SECTIONS.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>{section.title}</a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="terms-body">
          {TERMS_SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className="terms-section">
              <h2>{sectionHeading(section.title)}</h2>
              {section.paragraphs.map((text) => (
                <p key={text.slice(0, 48)}>{text}</p>
              ))}
              {section.bullets?.length ? (
                <ul>
                  {section.bullets.map((item) => (
                    <li key={item.slice(0, 64)}>{item}</li>
                  ))}
                </ul>
              ) : null}
              {section.links?.length ? (
                <ul className="terms-links">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <a href={link.href} target="_blank" rel="noopener noreferrer">
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </article>

        <footer className="terms-footer">
          <button type="button" className="btn btn-primary btn-block" onClick={accept}>
            Я согласен
          </button>
        </footer>
      </main>
    </div>
  )
}
