import { useState } from 'react'
import {
  ArrowLeft,
  Bell,
  ChartNoAxesColumn,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Copy,
  Heart,
  Info,
  MessageCircle,
  Share2,
} from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { SectionTitle } from '../components/SectionTitle'
import { SoftFlash } from '../components/SoftFlash'
import { SoftLoader } from '../components/SoftLoader'
import { useApp } from '../context/useApp'
import './ActivityPage.css'
import './LikedPage.css'
import './UiKitPage.css'
import './WorkoutsPage.css'

const TYPE_TOKENS = [
  ['--font-display', 'Unbounded', 'Заголовки'],
  ['--font-brand', 'Syne', 'SPOTTER, только латиница'],
  ['--font-body', 'Manrope', 'Текст и UI'],
  ['--text-page-size', '1.4375rem', 'Заголовок страницы · 800'],
  ['--text-section-size', '1.05rem', 'Секция / empty · 700'],
  ['--text-gym-min / max', '1.25–1.375rem', 'Имя зала над CTA · 800'],
  ['--text-label-size', '0.8125rem', 'Кикер и label · 600'],
  ['--letter-tight', '−0.03em', 'Только Unbounded, не кикеры'],
] as const

const COLOR_TOKENS = [
  ['--bg', 'Фон'],
  ['--bg-elevated', 'Elevated'],
  ['--bg-soft', 'Soft / трек сегмента'],
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
 * Keep in sync with .cursor/rules/spotter-ui-kit.mdc
 */
export function UiKitPage() {
  const navigate = useNavigate()
  const { user, canViewUsers, canManageAdmins } = useApp()
  const [toggleOn, setToggleOn] = useState(true)
  const [segDemo, setSegDemo] = useState<'ex' | 'body'>('ex')
  const [segPeriod, setSegPeriod] = useState<7 | 30 | 90>(30)
  const [segLikes, setSegLikes] = useState<'received' | 'sent'>('received')
  const [hintOpen, setHintOpen] = useState(false)
  const [flashDemo, setFlashDemo] = useState('')

  if (!user?.isAdmin) return <Navigate to="/app/profile" replace />
  if (!canViewUsers && !canManageAdmins) return <Navigate to="/app/admin" replace />

  const showFlash = (msg: string) => {
    setFlashDemo(msg)
    window.setTimeout(() => setFlashDemo(''), 1800)
  }

  return (
    <main className="page ui-kit-page">
      <div className="subpage-top">
        <button type="button" className="back-link" onClick={() => navigate('/app/admin')}>
          <ArrowLeft size={18} /> Админка
        </button>

        <header className="page-header">
          <div className="page-header-text">
            <h1 className="page-title">UI kit</h1>
            <p className="muted ui-kit-lead">
              Живой эталон Spotter. Перед новым экраном или CTA сверься с правилами ниже — не
              изобретай локальные отступы, размеры кнопок и «праздники» мимо системы.
            </p>
          </div>
        </header>
      </div>

      <section className="surface ui-kit-block">
        <SectionTitle>Правила продукта</SectionTitle>
        <ul className="ui-kit-rules">
          <li>
            <strong>Одна задача на экран.</strong> Primary — одно действие; остальное quieter.
          </li>
          <li>
            <strong>Вес CTA:</strong> primary 48px · secondary soft/ghost · <code>btn-sm</code> 40px
            для второстепенных block. Не строй стену одинаковых 48px ghost.
          </li>
          <li>
            <strong>Назад:</strong> всегда <code>.subpage-top</code> → gap 14px до заголовка. Не
            дублируй margin <code>.back-link</code> с grid-gap страницы. Секция тренировок: хаб{' '}
            <code>/app/workouts</code>, вложенные экраны возвращаются туда с <code>replace</code>, с
            хаба выход — <code>/app</code> («Мой зал»), тоже <code>replace</code>. Не{' '}
            <code>navigate(-1)</code> и не пушить хаб поверх прогресса/записи.
          </li>
          <li>
            <strong>Фидбек:</strong> MomentFX — только чекин/выход/редкий момент. Рутина (лайк,
            копирование, шер) — <code>SoftFlash</code>.
          </li>
          <li>
            <strong>Шиты:</strong> chrome через <code>.app-sheet*</code> (
            <code>src/styles/sheets.css</code>); контент — feature-классы.
          </li>
          <li>
            <strong>Empty:</strong> <code>.empty-copy</code> + title + lead + один CTA (secondary —
            <code>btn-sm</code>).
          </li>
          <li>
            <strong>Списки с несколькими действиями:</strong> primary слева (навигация), secondary
            справа/отдельной полосой (expand, copy). Не вешать всё на одну кнопку. Люди/клубы —
            карточки, история — одна группа, лайки — ряды с линией, не <code>.surface</code> на
            каждый ряд.
          </li>
          <li>
            <strong>Сегмент:</strong> взаимоисключающий вид — только <code>.seg seg--fit</code> +{' '}
            <code>.seg-item.is-active</code>. Обнимает текст, не тянется. Не чипы и не{' '}
            <code>.toggle</code>. Живые: Прогресс, Лайки, Активность, Уведомления.
          </li>
          <li>
            <strong>Действие у SectionTitle:</strong> только <code>.section-action</code> (Link или
            button) — muted Manrope, без underline и без <code>text-link</code> с жирным весом.
          </li>
          <li>
            <strong>Входы в разделы:</strong> <code>.entry-link</code> — product tools на Home.
            Обратная связь — Settings <code>btn-ghost</code>. Админка — ghost внизу профиля (только
            isAdmin).
          </li>
          <li>
            <strong>Заголовки:</strong> только Unbounded и токены{' '}
            <code>--text-page-size</code> (1.4375rem / 800), <code>--text-section-size</code>{' '}
            (1.05rem / 700). Не ставь 1.75rem и не выдумывай локальный кегль. Полная шкала — блок
            «Типографика».
          </li>
          <li>
            <strong>Кикер / label:</strong> как обычный текст — <code>--text-label-size</code> · 600,
            без <code>uppercase</code> и без letter-spacing 0.04–0.10em.
          </li>
          <li>
            <strong>Лоадер:</strong> только <code>SoftLoader</code> в слоте будущего контента. Chrome
            и primary CTA не двигаются. Полное правило — блок «Лоадер» ниже.
          </li>
        </ul>
      </section>

      <section className="surface ui-kit-block">
        <SectionTitle>Цвета</SectionTitle>
        <p className="muted ui-kit-section-lead">
          Один primary accent. Warning/danger — только для expire и опасных действий, не конкурируют
          с «Я в зале».
        </p>
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
        <p className="muted ui-kit-section-lead">
          Три семейства — не подключай четвёртое. Unbounded меньше, чем раньше (страница 23px, не
          28px), жирность та же. Кикеры без капса и широкого трекинга. Веса только из файлов: 650/750
          браузер синтезирует, для нового UI не используй.
        </p>

        <h3 className="ui-kit-type-sub">Токены — сверяйся сюда</h3>
        <div className="ui-kit-type-tokens">
          {TYPE_TOKENS.map(([token, value, role]) => (
            <div key={token} className="ui-kit-type-token">
              <code>{token}</code>
              <strong>{value}</strong>
              <span className="dim">{role}</span>
            </div>
          ))}
        </div>

        <h3 className="ui-kit-type-sub">Семейства</h3>
        <div className="ui-kit-font-cards">
          <article className="ui-kit-font-card">
            <p className="ui-kit-font-card-name" style={{ fontFamily: 'var(--font-display)' }}>
              Unbounded
            </p>
            <p className="ui-kit-font-card-role">Заголовки</p>
            <p className="muted">
              <code>--font-display</code> · кириллица, спорт. Страницы 1.4375rem / 800, секции
              1.05rem / 700, empty, цифры активности 1.5–1.75rem, имя зала, карточки людей.
            </p>
            <p className="dim">Загружено: 600 · 700 · 800</p>
          </article>
          <article className="ui-kit-font-card">
            <p className="ui-kit-font-card-name" style={{ fontFamily: 'var(--font-brand)' }}>
              Syne
            </p>
            <p className="ui-kit-font-card-role">Бренд</p>
            <p className="muted">
              <code>--font-brand</code> · только латиница SPOTTER. Логотип, лендинг, lock/emergency.
              Не для русских заголовков.
            </p>
            <p className="dim">Загружено: 700 · 800</p>
          </article>
          <article className="ui-kit-font-card">
            <p className="ui-kit-font-card-name" style={{ fontFamily: 'var(--font-body)' }}>
              Manrope
            </p>
            <p className="ui-kit-font-card-role">Текст и UI</p>
            <p className="muted">
              <code>--font-body</code> · абзацы, кнопки, поля, muted/dim, section-action, чипы,
              навигация. Кикер и label — 600, как обычный текст, без капса.
            </p>
            <p className="dim">Загружено: 400 · 500 · 600 · 700</p>
          </article>
          <article className="ui-kit-font-card">
            <p
              className="ui-kit-font-card-name"
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
            >
              System mono
            </p>
            <p className="ui-kit-font-card-role">Код</p>
            <p className="muted">Только UI kit и отладка. В продуктовых экранах не ставить.</p>
            <p className="dim">Системный стек, не пакет</p>
          </article>
        </div>

        <h3 className="ui-kit-type-sub">Веса</h3>
        <div className="ui-kit-weight-block">
          <p className="dim ui-kit-meta">Unbounded</p>
          <p className="ui-kit-weight-line ui-kit-w-display" style={{ fontWeight: 600 }}>
            600 Полужирный — запас, редко
          </p>
          <p className="ui-kit-weight-line ui-kit-w-display" style={{ fontWeight: 700 }}>
            700 Жирный — секции, empty, активность
          </p>
          <p className="ui-kit-weight-line ui-kit-w-display" style={{ fontWeight: 800 }}>
            800 Extra — заголовок страницы, имя зала
          </p>
        </div>
        <div className="ui-kit-weight-block">
          <p className="dim ui-kit-meta">Syne</p>
          <p className="ui-kit-weight-line ui-kit-w-brand" style={{ fontWeight: 700 }}>
            700 SPOTTER
          </p>
          <p className="ui-kit-weight-line ui-kit-w-brand" style={{ fontWeight: 800 }}>
            800 SPOTTER · .brand-mark
          </p>
        </div>
        <div className="ui-kit-weight-block">
          <p className="dim ui-kit-meta">Manrope</p>
          <p className="ui-kit-weight-line" style={{ fontWeight: 400 }}>
            400 Regular — длинный текст
          </p>
          <p className="ui-kit-weight-line" style={{ fontWeight: 500 }}>
            500 Medium — кнопки, section-action, поля
          </p>
          <p className="ui-kit-weight-line" style={{ fontWeight: 600 }}>
            600 Semibold — кикер, label, чипы
          </p>
          <p className="ui-kit-weight-line" style={{ fontWeight: 700 }}>
            700 Bold — счётчики, сильный акцент
          </p>
        </div>

        <h3 className="ui-kit-type-sub">Шкала ролей</h3>
        <div className="ui-kit-type-table" role="table">
          {(
            [
              ['Страница', '.page-title', 'Unbounded 800', '1.4375rem', 'lh 1.15', '−0.03em'],
              ['Зал над CTA', '.home-gym-title', 'Unbounded 800', '1.25–1.375', 'lh 1.15', '−0.03em'],
              ['Секция', '.section-heading', 'Unbounded 700', '1.05rem', 'lh 1.25', '−0.03em'],
              ['Empty title', '.empty-copy-title', 'Unbounded 700', '1.05rem', 'lh inherit', '−0.03em'],
              ['Цифра / пик', '.activity-summary-total', 'Unbounded 700', '1.5–1.75', 'lh 1.05', 'tight'],
              ['Бренд', '.brand-mark', 'Syne 800', '1.75–2.4', 'lh inherit', '−0.04em'],
              ['Kicker', '.page-kicker', 'Manrope 600', '0.8125rem', 'lh 1.2', 'без капса'],
              ['Label', 'token --text-label', 'Manrope 600', '0.8125rem', 'lh inherit', '0'],
              ['Тело', 'body / p', 'Manrope 400', '1rem', 'lh 1.45', '0'],
              ['Muted', '.muted', 'Manrope 400', '0.9rem', 'lh 1.45', '0'],
              ['Dim', '.dim', 'Manrope 400', '0.84rem', 'lh inherit', '0'],
              ['Section action', '.section-action', 'Manrope 500', '0.9rem', 'lh 1.35', '0'],
              ['Кнопка', '.btn', 'Manrope 650*', 'inherit', 'lh inherit', '0'],
              ['Empty lead', '.empty-copy-lead', 'Manrope 400', '0.92rem', 'lh 1.4', '0'],
            ] as const
          ).map(([role, token, face, size, line, track]) => (
            <div key={role} className="ui-kit-type-row" role="row">
              <strong>{role}</strong>
              <code>{token}</code>
              <span className="muted">{face}</span>
              <span className="dim">
                {size} · {line} · {track}
              </span>
            </div>
          ))}
        </div>
        <p className="dim" style={{ margin: '10px 0 0' }}>
          * 650 нет в файлах — браузер рисует между 600/700. Новые роли: 500 / 600 / 700 / 800.
          Кикеры и лейблы — как обычный текст, без uppercase и без трекинга 0.04–0.10em.
        </p>

        <h3 className="ui-kit-type-sub">Живые образцы</h3>
        <div className="ui-kit-type-stack">
          <div>
            <p className="dim ui-kit-meta">.brand-mark · Syne 800 · −0.04em</p>
            <p className="brand-mark">
              SPOT<span>TER</span>
            </p>
          </div>
          <div>
            <p className="dim ui-kit-meta">.page-kicker · Manrope 600 · без капса</p>
            <p className="page-kicker">DDX Fitness</p>
          </div>
          <div>
            <p className="dim ui-kit-meta">.page-title · Unbounded 800 · 1.4375rem · −0.03em</p>
            <h1 className="page-title">Мой зал</h1>
          </div>
          <div>
            <p className="dim ui-kit-meta">.home-gym-title · Unbounded 800 · 1.25–1.375rem</p>
            <h2 className="ui-kit-gym-title">Рязанский проспект</h2>
          </div>
          <div>
            <p className="dim ui-kit-meta">
              .activity-summary-total · Unbounded 700 · 1.5–1.75rem
            </p>
            <strong className="activity-summary-total">12 ч 40 мин</strong>
          </div>
          <div>
            <p className="dim ui-kit-meta">SectionTitle · Unbounded 700 · 1.05rem + action Manrope 500</p>
            <SectionTitle
              action={
                <Link to="/app/profile" className="section-action">
                  Действие
                </Link>
              }
            >
              Люди в зале
            </SectionTitle>
          </div>
          <div>
            <p className="dim ui-kit-meta">.empty-copy-title · Unbounded 700 · 1.05rem</p>
            <p className="empty-copy-title">Пока пусто</p>
          </div>
          <div>
            <p className="dim ui-kit-meta">body / .muted / .dim · Manrope</p>
            <p>Обычный текст. Съешь ещё этих мягких французских булок.</p>
            <p className="muted">Muted — пояснения и подписи.</p>
            <p className="dim">Dim — мета, счётчики, quiet-иконки.</p>
          </div>
          <div>
            <p className="dim ui-kit-meta">Трекинг</p>
            <p className="ui-kit-track-tight">Заголовок −0.03em · Unbounded</p>
            <p className="ui-kit-track-wide">Кикер как предложение · Manrope 600</p>
            <p className="ui-kit-track-none">Текст без трекинга · Manrope</p>
          </div>
        </div>
      </section>

      <section className="surface ui-kit-block">
        <SectionTitle>Навигация вторичных экранов</SectionTitle>
        <p className="muted ui-kit-section-lead">
          Класс <code>.subpage-top</code> в <code>global.css</code>: grid gap <strong>14px</strong>,
          у прямого <code>.back-link</code> margin обнулён. Пример уже наверху этой страницы.
        </p>
        <pre className="ui-kit-code">{`<div className="subpage-top">
  <button className="back-link">…</button>
  <header className="page-header">
    <div className="page-header-text">… page-title …</div>
    {/* actions (⋯) — сюда, не в один ряд с back */}
  </header>
</div>`}</pre>
        <p className="dim" style={{ margin: '10px 0 0' }}>
          Не оборачивай <code>back-link</code> в flex-ряд с <code>icon-btn</code> — высота ряда
          ломает визуальный gap 14px. Горизонтальные ряды (чат, чужой профиль) — исключение: back в
          одной линии с actions, margin 0 локально.
        </p>
      </section>

      <section className="surface ui-kit-block">
        <SectionTitle>Кнопки</SectionTitle>
        <p className="muted ui-kit-section-lead">
          Primary — главное. Soft — заметное вторичное (инвайт, «записать»). Ghost / quiet links —
          переходы без веса. <code>btn-sm</code> — когда secondary тоже block, но не должен спорить
          с primary.
        </p>
        <div className="stack">
          <button type="button" className="btn btn-primary btn-block">
            Primary · 48px
          </button>
          <button type="button" className="btn btn-soft btn-block">
            Soft · 48px
          </button>
          <button type="button" className="btn btn-soft btn-sm btn-block">
            Soft · sm · 40px
          </button>
          <button type="button" className="btn btn-ghost btn-sm btn-block">
            <Share2 size={16} /> Ghost · sm
          </button>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            <button type="button" className="btn btn-primary">
              Inline
            </button>
            <button type="button" className="icon-btn" aria-label="Пример">
              <Bell size={20} />
            </button>
            <button type="button" className="btn btn-danger-ghost btn-sm">
              Danger ghost
            </button>
          </div>
        </div>
        <p className="dim" style={{ margin: '12px 0 0' }}>
          В профиле настройки — только шестерёнка в шапке. Не дублируй «Редактировать профиль»
          огромной кнопкой внизу. Обратная связь — Настройки → Поддержка (
          <code>btn-ghost btn-block</code>). Админка — только у админов, контурная кнопка внизу
          профиля.
        </p>
      </section>

      <section className="surface ui-kit-block">
        <SectionTitle>Входы в разделы (.entry-link)</SectionTitle>
        <p className="muted ui-kit-section-lead">
          Product tools вне bottom-nav (Home): <code>.entry-tools--2</code> +{' '}
          <code>.entry-link</code>. Support в настройках — обычная <code>btn-ghost</code>, не
          entry-link. Контекст «нет зала» — <code>btn-soft btn-sm</code>.
        </p>
        <nav className="entry-tools entry-tools--2" aria-label="Пример A" style={{ marginBottom: 12 }}>
          <Link to="/app/workouts" className="entry-link">
            <ClipboardList size={18} aria-hidden />
            <span>Тренировки</span>
            <ChevronRight size={16} aria-hidden />
          </Link>
          <Link to="/app/activity" className="entry-link">
            <ChartNoAxesColumn size={18} aria-hidden />
            <span>Активность</span>
            <ChevronRight size={16} aria-hidden />
          </Link>
        </nav>
        <Link to="/app/feedback" className="btn btn-ghost btn-block">
          Обратная связь
        </Link>
      </section>

      <section className="surface ui-kit-block">
        <SectionTitle>Строка списка: primary + secondary</SectionTitle>
        <p className="muted ui-kit-section-lead">
          После облегчения визуала — четыре рецепта, не выдумывай пятый. Люди / клубы — карточки.
          История тренировок — одна группа. Лайки — ряды с линией. Чаты — плоские ряды. Не оборачивай
          каждый ряд в <code>.surface</code>.
        </p>
        <div className="ui-kit-type-stack">
          <div>
            <p className="dim ui-kit-meta">История · .workouts-list (одна карточка, линия между сессиями)</p>
            <ul className="workouts-list ui-kit-list-demo">
              <li className="workouts-board">
                <div className="workouts-board-top">
                  <div className="workouts-board-main" style={{ cursor: 'default' }}>
                    <div className="workouts-row-copy">
                      <strong>Жим · верх</strong>
                      <span className="muted">Сегодня · 78 кг</span>
                    </div>
                  </div>
                  <button type="button" className="workouts-row-copy-btn" aria-label="Копировать пример">
                    <Copy size={16} strokeWidth={2} />
                  </button>
                </div>
                <button type="button" className="workouts-board-expand" aria-expanded={false}>
                  <span className="dim workouts-row-meta">3 упр. · 12 подх.</span>
                  <ChevronDown size={16} className="workouts-board-chevron" aria-hidden />
                </button>
              </li>
              <li className="workouts-board">
                <div className="workouts-board-top">
                  <div className="workouts-board-main" style={{ cursor: 'default' }}>
                    <div className="workouts-row-copy">
                      <strong>Ноги</strong>
                      <span className="muted">Вчера · 82 кг</span>
                    </div>
                  </div>
                  <button type="button" className="workouts-row-copy-btn" aria-label="Копировать пример">
                    <Copy size={16} strokeWidth={2} />
                  </button>
                </div>
                <button type="button" className="workouts-board-expand" aria-expanded={false}>
                  <span className="dim workouts-row-meta">4 упр. · 16 подх.</span>
                  <ChevronDown size={16} className="workouts-board-chevron" aria-hidden />
                </button>
              </li>
            </ul>
          </div>
          <div>
            <p className="dim ui-kit-meta">Лайки · .liked-list / .liked-row (линия, без карточки на ряд)</p>
            <div className="liked-list ui-kit-list-demo">
              <article className="liked-row">
                <div className="liked-main">
                  <div className="avatar-wrap ui-kit-liked-avatar" aria-hidden />
                  <div className="liked-body">
                    <div className="liked-title-line">
                      <strong>
                        Анна<span className="age">, 27</span>
                      </strong>
                    </div>
                    <p className="gym-line">DDX · Рязанский</p>
                    <p className="muted preview">Открыть профиль</p>
                  </div>
                </div>
                <div className="liked-actions">
                  <span className="liked-action primary">
                    <MessageCircle size={16} />
                  </span>
                  <span className="liked-action liked">
                    <Heart size={16} />
                  </span>
                </div>
              </article>
              <article className="liked-row">
                <div className="liked-main">
                  <div className="avatar-wrap ui-kit-liked-avatar" aria-hidden />
                  <div className="liked-body">
                    <div className="liked-title-line">
                      <strong>
                        Макс<span className="age">, 31</span>
                      </strong>
                    </div>
                    <p className="gym-line">World Class</p>
                    <p className="muted preview">Силовые, зал вечером</p>
                  </div>
                </div>
                <div className="liked-actions">
                  <span className="liked-action">
                    <MessageCircle size={16} />
                  </span>
                  <span className="liked-action">
                    <Heart size={16} />
                  </span>
                </div>
              </article>
            </div>
          </div>
          <p className="dim" style={{ margin: 0 }}>
            Люди в зале — <code>UserCard</code>. Каталог клубов — <code>GymCard</code>. Лента
            уведомлений — <code>.card-list</code> с <code>gap: 10px</code> (глобально gap 0). Профиль
            — <code>.profile-block</code>, без стопки surface.
          </p>
        </div>
      </section>

      <section className="surface ui-kit-block">
        <SectionTitle>Empty state</SectionTitle>
        <p className="muted ui-kit-section-lead">
          Рецепт: иконка (опционально) · <code>.empty-copy-title</code> ·{' '}
          <code>.empty-copy-lead</code> · один primary CTA. Второй CTA — soft/ghost +{' '}
          <code>btn-sm</code>.
        </p>
        <div className="empty-copy-actions">
          <div className="empty-copy" role="status">
            <p className="empty-copy-title">Пока пусто</p>
            <p className="empty-copy-lead">Одна фраза — что сделать дальше</p>
          </div>
          <button type="button" className="btn btn-primary btn-block">
            Главное действие
          </button>
          <button type="button" className="btn btn-ghost btn-sm btn-block">
            Второстепенное
          </button>
        </div>
      </section>

      <section className="surface ui-kit-block">
        <SectionTitle>Лоадер</SectionTitle>
        <p className="muted ui-kit-section-lead">
          Перед любым спиннером на странице сверься с этим блоком. Один компонент:{' '}
          <code>SoftLoader</code>. Не рисуй свои кольца, скелетоны и «три точки».
        </p>
        <ul className="ui-kit-rules">
          <li>
            <strong>Слот, не шапка.</strong> Хедер, табы и primary CTA уже на месте и не двигаются.
            Лоадер живёт только в области, куда придёт контент (история, лента, список людей).
          </li>
          <li>
            <strong>Резерв высоты.</strong> Слот держит ~120px (<code>.soft-loader</code>), чтобы
            кольцо не схлопывало экран и контент не выпрыгивал из-под кнопки.
          </li>
          <li>
            <strong>Задержка кольца 280–400ms.</strong> Быстрый ответ — без вспышки спиннера.{' '}
            <code>SOFT_LOADER_DELAY_MS</code> (320) на самом <code>SoftLoader</code>. Если родитель
            уже ждал (зал: 1с в <code>useGymPeople</code>) — <code>{'delayMs={0}'}</code>.
          </li>
          <li>
            <strong>Не путать с empty.</strong> Пока грузимся — только лоадер. «Пока пусто» только
            после ответа, когда список реально пуст.
          </li>
          <li>
            <strong>Один индикатор на регион.</strong> Кнопка в процессе — меняет подпись
            («Сохраняем…», «Загружаем…»), без второго кольца рядом.
          </li>
          <li>
            <strong>Не блокируй главное действие.</strong> «Записать тренировку» доступна, пока
            грузится история. Пользователь не ждёт спиннер, чтобы начать работу.
          </li>
          <li>
            <strong>Баннеры и стрипы</strong> не всплывают над CTA во время загрузки — иначе кнопка
            прыгает. Вторичный контент рисуй в том же слоте, что и список, и только после{' '}
            <code>!loading</code>.
          </li>
          <li>
            <strong>Доступность.</strong> Регион — <code>aria-busy</code>. Лоадер —{' '}
            <code>role="status"</code> и короткая фраза («Загружаем тренировки…»).
          </li>
        </ul>
        <div className="ui-kit-loader-demo" aria-hidden>
          <button type="button" className="btn btn-primary btn-block" tabIndex={-1}>
            Главное действие остаётся
          </button>
          <SoftLoader delayMs={0} label="Загружаем список…" />
        </div>
      </section>

      <section className="surface ui-kit-block">
        <SectionTitle>Фидбек: SoftFlash vs MomentFX</SectionTitle>
        <p className="muted ui-kit-section-lead">
          <code>SoftFlash</code> — тихий статус внизу (лайк, копирование, шер). MomentFX — короткий
          celebration у чекина. Не смешивай.
        </p>
        <button
          type="button"
          className="btn btn-soft btn-sm"
          onClick={() => showFlash('Ссылка скопирована')}
        >
          Показать SoftFlash
        </button>
      </section>

      <section className="surface ui-kit-block">
        <SectionTitle>Bottom sheet</SectionTitle>
        <p className="muted ui-kit-section-lead">
          Chrome: <code>.app-sheet</code> + <code>.app-sheet-backdrop</code> +{' '}
          <code>.app-sheet-panel</code> + <code>.app-sheet-grab</code>. A11y —{' '}
          <code>useSheetA11y</code>. Не копируй пятый диалект backdrop CSS.
        </p>
        <pre className="ui-kit-code">{`<div className="app-sheet feature-sheet">
  <button className="app-sheet-backdrop" />
  <div className="app-sheet-panel feature-sheet-panel" role="dialog">
    <div className="app-sheet-grab" />
    …
  </div>
</div>`}</pre>
      </section>

      <section className="surface ui-kit-block">
        <SectionTitle>Сегмент</SectionTitle>
        <p className="muted ui-kit-section-lead">
          Единственный рецепт взаимоисключающего вида (2–4 пункта). Не чип (фильтр, можно несколько)
          и не <code>.toggle</code> (вкл/выкл). Трек обнимает текст — на сетке страницы не растягивать.
          Пункт — <code>button</code> или <code>Link</code> с классом <code>.seg-item</code>.
        </p>
        <ul className="ui-kit-rules">
          <li>
            Chrome: <code>.seg seg--fit</code> + <code>.seg-item</code>, активный —{' '}
            <code>.is-active</code>. Роль <code>tablist</code> / <code>tab</code>.
          </li>
          <li>
            Размер: трек <code>width: max-content</code>, пункт <code>min-height: 32px</code>,{' '}
            <code>padding: 6px 12px</code>, Manrope 600 · 0.82rem. Активный —{' '}
            <code>--bg-elevated</code>.
          </li>
          <li>
            Не <code>.seg--fill</code>, не чипы, не локальные табы (
            <code>liked-tabs</code> только margin). На grid-странице —{' '}
            <code>justify-self: start</code>, если трек всё равно тянется.
          </li>
        </ul>
        <div className="ui-kit-type-stack" style={{ marginTop: 16 }}>
          <div>
            <p className="dim ui-kit-meta">Прогресс · вид</p>
            <div className="seg seg--fit" role="tablist" aria-label="Что смотреть">
              <button
                type="button"
                role="tab"
                aria-selected={segDemo === 'ex'}
                className={`seg-item${segDemo === 'ex' ? ' is-active' : ''}`}
                onClick={() => setSegDemo('ex')}
              >
                Упражнения
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={segDemo === 'body'}
                className={`seg-item${segDemo === 'body' ? ' is-active' : ''}`}
                onClick={() => setSegDemo('body')}
              >
                Мой вес
              </button>
            </div>
          </div>
          <div>
            <p className="dim ui-kit-meta">Прогресс / Активность · период</p>
            <div className="seg seg--fit" role="tablist" aria-label="Период">
              {([7, 30, 90] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={segPeriod === id}
                  className={`seg-item${segPeriod === id ? ' is-active' : ''}`}
                  onClick={() => setSegPeriod(id)}
                >
                  {id}д
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="dim ui-kit-meta">Лайки / Уведомления · длинные подписи, тот же трек</p>
            <div className="seg seg--fit" role="tablist" aria-label="Лайки">
              <button
                type="button"
                role="tab"
                aria-selected={segLikes === 'received'}
                className={`seg-item${segLikes === 'received' ? ' is-active' : ''}`}
                onClick={() => setSegLikes('received')}
              >
                Кто лайкнул
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={segLikes === 'sent'}
                className={`seg-item${segLikes === 'sent' ? ' is-active' : ''}`}
                onClick={() => setSegLikes('sent')}
              >
                Кого я лайкнул
              </button>
            </div>
          </div>
        </div>
        <pre className="ui-kit-code" style={{ marginTop: 16 }}>{`<div className="seg seg--fit" role="tablist" aria-label="…">
  <button type="button" role="tab" className="seg-item is-active">…</button>
  <button type="button" role="tab" className="seg-item">…</button>
</div>
{/* Лайки: Link с теми же классами вместо button */}`}</pre>
        <p className="dim" style={{ margin: '10px 0 0' }}>
          Живые экраны: Прогресс, Лайки, Активность, Уведомления.
        </p>
      </section>

      <section className="surface ui-kit-block">
        <SectionTitle>Вкл / выкл</SectionTitle>
        <p className="muted ui-kit-section-lead">
          Один флаг в настройках, не смена вида. Не подменяй сегмент тогглом и наоборот.
        </p>
        <button
          type="button"
          className="toggle-row"
          onClick={() => setToggleOn((v) => !v)}
        >
          <div>
            <strong>Пуш-уведомления</strong>
            <p className="muted">.toggle-row + .toggle</p>
          </div>
          <span className={`toggle ${toggleOn ? 'on' : ''}`} />
        </button>
      </section>

      <section className="surface ui-kit-block">
        <SectionTitle>Чипы и пиллы</SectionTitle>
        <p className="muted ui-kit-section-lead">
          Метки и мультифильтры (пол, спорт, «в зале»). Не для взаимоисключающего вида — там только{' '}
          <code>.seg</code>. Не как главные CTA раздела.
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
        <SectionTitle
          action={
            <button type="button" className="section-action" onClick={() => undefined}>
              Изменить
            </button>
          }
        >
          Section action
        </SectionTitle>
        <p className="muted ui-kit-section-lead">
          Правое действие у заголовка блока — всегда <code>.section-action</code>: и Link («Кого я
          лайкнул», «Добавить»), и button («Изменить»). Не использовать <code>text-link</code> здесь.
          Счётчики/статус без клика — <code>.muted</code> или <code>.dim</code>.
        </p>
        <div className="ui-kit-type-stack" style={{ marginTop: 12 }}>
          <SectionTitle
            action={
              <Link to="/app/profile" className="section-action">
                Кого я лайкнул · 3
              </Link>
            }
          >
            Лайки
          </SectionTitle>
          <SectionTitle action={<span className="muted">12 человек</span>}>Люди в зале</SectionTitle>
        </div>
      </section>

      <section className="surface ui-kit-block">
        <SectionTitle
          action={
            <Link to="/app/profile" className="section-action">
              Ссылка
            </Link>
          }
        >
          Блок surface
        </SectionTitle>
        <p className="muted">
          Карточка группы: <code>.surface</code> + контент. Не стопка surface на экране (профиль —
          <code>.profile-block</code> с линией). Заголовок блока — только <code>SectionTitle</code>.
        </p>
      </section>

      <section className="surface ui-kit-block">
        <SectionTitle>Тултип / подсказка</SectionTitle>
        <p className="muted ui-kit-section-lead">
          <code>.ui-hint</code> — короткие пояснения (1–2 предложения), не для ошибок.
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
        Токены: <code>src/styles/global.css</code>, шиты: <code>src/styles/sheets.css</code>, flash:{' '}
        <code>SoftFlash</code>, правило агента: <code>.cursor/rules/spotter-ui-kit.mdc</code>. Живой
        экран: <code>/app/admin/ui</code>.
      </p>

      <SoftFlash message={flashDemo} />
    </main>
  )
}
