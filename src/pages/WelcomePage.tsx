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
          <h1 className="brand-mark">
            SPOT<span>TER</span>
          </h1>
          <p className="welcome-lead">
            Найди своих в тренажёрном зале: кто рядом, кто сейчас на тренировке и кто открыт к
            общению.
          </p>
          <div className="welcome-actions">
            <Link to="/register" className="btn btn-primary btn-block">
              Создать аккаунт
              <ArrowRight size={18} />
            </Link>
            <Link to="/login" className="btn btn-ghost btn-block">
              У меня уже есть аккаунт
            </Link>
          </div>
        </div>

        <section className="welcome-points">
          <article>
            <Radio size={20} />
            <div>
              <h3>Живой статус зала</h3>
              <p className="muted">Видно, кто сейчас на тренировке в твоём клубе.</p>
            </div>
          </article>
          <article>
            <EyeOff size={20} />
            <div>
              <h3>Анонимность по желанию</h3>
              <p className="muted">Можно скрыть фото и имя, пока не решишь открыться.</p>
            </div>
          </article>
          <article>
            <MessageSquare size={20} />
            <div>
              <h3>Запросы в чат</h3>
              <p className="muted">Переписка начинается только после принятия запроса.</p>
            </div>
          </article>
        </section>
      </main>
    </div>
  )
}
