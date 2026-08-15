import { ArrowRight, EyeOff, MessageSquare, Radio } from 'lucide-react'
import { Link } from 'react-router-dom'
import './WelcomePage.css'

export function WelcomePage() {
  return (
    <div className="app-shell">
      <main className="page no-nav welcome">
        <div className="welcome-hero">
          <div className="welcome-glow" />
          <p className="welcome-kicker">Знакомства в зале</p>
          <h1 className="brand-mark" aria-label="Spotter">
            SPOT<span>TER</span>
          </h1>
          <p className="welcome-lead">
            Найди людей в своём клубе: кто рядом, кто на тренировке и кто открыт к общению
          </p>
          <div className="welcome-actions">
            <Link to="/register" className="btn btn-primary btn-block">
              Создать аккаунт
              <ArrowRight size={18} aria-hidden />
            </Link>
            <Link to="/login" className="btn btn-ghost btn-block">
              У меня уже есть аккаунт
            </Link>
          </div>
        </div>

        <section className="welcome-points">
          <article>
            <span className="welcome-points-icon" aria-hidden>
              <Radio size={18} />
            </span>
            <div className="welcome-points-copy">
              <h3>Живой статус зала</h3>
              <p className="muted">
                Видно, кто сейчас на тренировке
                <br />
                в твоём клубе
              </p>
            </div>
          </article>
          <article>
            <span className="welcome-points-icon" aria-hidden>
              <EyeOff size={18} />
            </span>
            <div className="welcome-points-copy">
              <h3>Анонимность по желанию</h3>
              <p className="muted">Можно скрыть фото и имя, пока не решишь открыться</p>
            </div>
          </article>
          <article>
            <span className="welcome-points-icon" aria-hidden>
              <MessageSquare size={18} />
            </span>
            <div className="welcome-points-copy">
              <h3>Запросы в чат</h3>
              <p className="muted">Переписка начинается только после принятия запроса</p>
            </div>
          </article>
        </section>

        <footer className="welcome-legal">
          <p>© {new Date().getFullYear()} Spotter. Все права защищены.</p>
          <p>
            <a href="mailto:info@spottergym.ru">info@spottergym.ru</a>
            {' · '}
            <Link to="/terms?from=welcome">Пользовательское соглашение</Link>
          </p>
        </footer>
      </main>
    </div>
  )
}
