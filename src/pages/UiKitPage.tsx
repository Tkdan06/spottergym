import { useState } from 'react'
import { ArrowLeft, Bell, Info, Share2 } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { SectionTitle } from '../components/SectionTitle'
import { useApp } from '../context/useApp'
import './UiKitPage.css'

const COLOR_TOKENS = [
  ['--bg', 'Фон'],
  ['--bg-elevated', 'Elevated'],
  ['--bg-card', 'Карточка'],
  ['--accent', 'Accent'],
  ['--text', 'Текст'],
  ['--text-muted', 'Muted'],
  ['--text-dim', 'Dim'],
  ['--online', 'Online'],
  ['--danger', 'Danger'],
  ['--warning', 'Warning'],
] as const

/**
 * Living UI kit — reference for new screens.
 * Route: /app/admin/ui (admins only).
 */
export function UiKitPage() {
  const navigate = useNavigate()
  const { user, canViewUsers, canManageAdmins } = useApp()
  const [toggleOn, setToggleOn] = useState(true)
  const [hintOpen, setHintOpen] = useState(false)

  if (!user?.isAdmin) return <Navigate to="/app/profile" replace />
  // UI kit — internal design reference; only for staff with broader access
  if (!canViewUsers && !canManageAdmins) return <Navigate to="/app/admin" replace />

  return (
    <main className="page ui-kit-page">
      <button type="button" className="back-link" onClick={() => navigate('/app/admin')}>
        <ArrowLeft size={18} /> Админка
      </button>

      <header className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">UI kit</h1>
          <p className="muted ui-kit-lead">
            Эталон для новых экранов. Заголовки блоков — только через{' '}
            <code>SectionTitle</code> / <code>.section-title</code>. Не задавай локальный font-size
            для той же роли.
          </p>
        </div>
      </header>

      <section className="surface ui-kit-block">
        <SectionTitle>Цвета</SectionTitle>
        <div className="ui-kit-swatches">
          {COLOR_TOKENS.map(([token, label]) => (
            <div key={token} className="ui-kit-swatch">
              <span className="ui-kit-swatch-chip" style={{ background: `var(${token})` }} />
              <strong>{label}</strong>
              <code>{token}</code>
            </div>
          ))}
        </div>
      </section>

      <section className="surface ui-kit-block">
        <SectionTitle>Типографика</SectionTitle>
        <div className="ui-kit-type-stack">
          <div>
            <p className="dim ui-kit-meta">.page-title · --text-page-*</p>
            <h1 className="page-title">Заголовок страницы</h1>
          </div>
          <div>
            <p className="dim ui-kit-meta">SectionTitle · --text-section-*</p>
            <SectionTitle action={<span className="muted">Действие</span>}>
              Заголовок блока
            </SectionTitle>
          </div>
          <div>
            <p className="dim ui-kit-meta">body / .muted / .dim</p>
            <p>Обычный текст — Manrope, комфортная читаемость в карточках.</p>
            <p className="muted">Muted — вторичные пояснения и подписи.</p>
            <p className="dim">Dim — метаданные, счётчики, подсказки.</p>
          </div>
          <div>
            <p className="dim ui-kit-meta">.brand-mark</p>
            <p className="brand-mark">
              SPOT<span>TER</span>
            </p>
          </div>
        </div>
      </section>

      <section className="surface ui-kit-block">
        <SectionTitle>Кнопки</SectionTitle>
        <p className="muted" style={{ margin: '0 0 10px' }}>
          Primary — главное действие. Soft — вторичное в блоке. Ghost — переход / «открыть
          раздел» в профиле (круг, обращения, настройки).
        </p>
        <div className="stack">
          <button type="button" className="btn btn-primary btn-block">
            Primary
          </button>
          <button type="button" className="btn btn-soft btn-block">
            Soft
          </button>
          <button type="button" className="btn btn-ghost btn-block">
            <Share2 size={16} /> Ghost
          </button>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary">
              Inline
            </button>
            <button type="button" className="icon-btn" aria-label="Пример">
              <Bell size={20} />
            </button>
          </div>
        </div>
      </section>

      <section className="surface ui-kit-block">
        <SectionTitle>Чипы и пиллы</SectionTitle>
        <p className="muted" style={{ margin: '0 0 10px' }}>
          Чипы — метки и сущности (спорт, зал). Не использовать как главные CTA раздела — для
          переходов в экраны бери <code>.btn</code> (ghost / soft / primary).
        </p>
        <div className="chip-grid">
          <span className="chip">Обычный</span>
          <span className="chip active">Active</span>
          <span className="chip level">Уровень</span>
          <span className="chip coach">Тренер</span>
          <span className="pill pill-online">
            <i className="online-dot" aria-hidden />В зале
          </span>
          <span className="pill pill-offline">Не в зале</span>
        </div>
      </section>

      <section className="surface ui-kit-block">
        <SectionTitle action={<Link to="/app/profile" className="muted">Ссылка</Link>}>
          Блок surface
        </SectionTitle>
        <p className="muted">
          Карточка: <code>.surface</code> + контент. Заголовок всегда{' '}
          <code>&lt;SectionTitle&gt;</code>.
        </p>
        <button
          type="button"
          className="toggle-row"
          style={{ marginTop: 12 }}
          onClick={() => setToggleOn((v) => !v)}
        >
          <div>
            <strong>Переключатель</strong>
            <p className="muted">.toggle-row + .toggle</p>
          </div>
          <span className={`toggle ${toggleOn ? 'on' : ''}`} />
        </button>
      </section>

      <section className="surface ui-kit-block">
        <SectionTitle>Тултип / подсказка</SectionTitle>
        <p className="muted" style={{ margin: '0 0 10px' }}>
          Классы <code>.ui-hint</code>, <code>.ui-hint-trigger</code>, <code>.ui-hint-pop</code>.
          Иконка Info выравнивается по нижнему краю соседнего текста; отступ до панели 8px; шрифт
          панели — muted (<code>--text-muted-size</code>). Только короткие пояснения (1–2
          предложения), не для ошибок и не вместо основного текста.
        </p>
        <div className="ui-kit-hint-demo">
          <p className="muted" style={{ margin: 0 }}>
            Пример подписи рядом с подсказкой
          </p>
          <div className="ui-hint">
            <button
              type="button"
              className="ui-hint-trigger"
              aria-label="Пример подсказки"
              aria-expanded={hintOpen}
              onClick={() => setHintOpen((v) => !v)}
            >
              <Info size={14} strokeWidth={2.25} />
            </button>
            {hintOpen ? (
              <div className="ui-hint-pop" role="tooltip">
                Короткая подсказка: одно–два предложения, без лишней декорации.
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="surface ui-kit-block">
        <SectionTitle>Поля</SectionTitle>
        <div className="field">
          <label htmlFor="ui-kit-demo">Label</label>
          <input id="ui-kit-demo" placeholder="Placeholder" />
        </div>
      </section>

      <p className="dim ui-kit-note">
        Токены в <code>src/styles/global.css</code> (<code>--text-section-*</code>, цвета). Компонент{' '}
        <code>src/components/SectionTitle.tsx</code>. Перед новым экраном сверься с этой страницей.
      </p>
    </main>
  )
}
