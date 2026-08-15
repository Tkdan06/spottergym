import { Link } from 'react-router-dom'
import { useApp } from '../context/useApp'
import './NotFoundPage.css'

/** Broken / unknown URLs — stay on the bad path and offer a way home. */
export function NotFoundPage() {
  const { user } = useApp()
  const homeTo = user?.onboardingDone ? '/app' : user ? '/onboarding' : '/'

  return (
    <div className="app-shell">
      <main className="page no-nav not-found-page">
        <p className="not-found-code" aria-hidden>
          404
        </p>
        <h1 className="page-title">Страница не найдена</h1>
        <p className="muted not-found-lead">
          Такой ссылки нет или она устарела. Проверь адрес или вернись на главную.
        </p>
        <Link to={homeTo} className="btn btn-primary btn-block not-found-cta" replace>
          На главную
        </Link>
      </main>
    </div>
  )
}
