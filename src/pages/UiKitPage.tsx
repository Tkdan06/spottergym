import { useState } from 'react'
import {
  ArrowLeft,
  Bell,
  ChartNoAxesColumn,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Copy,
  Info,
  Share2,
} from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { SectionTitle } from '../components/SectionTitle'
import { SoftFlash } from '../components/SoftFlash'
import { useApp } from '../context/useApp'
import './UiKitPage.css'
import './WorkoutsPage.css'

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
 * Keep in sync with .cursor/rules/spotter-ui-kit.mdc
 */
export function UiKitPage() {
  const navigate = useNavigate()
  const { user, canViewUsers, canManageAdmins } = useApp()
  const [toggleOn, setToggleOn] = useState(true)
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
            дублируй margin <code>.back-link</code> с grid-gap страницы.
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
            справа/отдельной полосой (expand, copy). Не вешать всё на одну кнопку.
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
        <div className="ui-kit-type-stack">
          <div>
            <p className="dim ui-kit-meta">.page-title · --text-page-*</p>
            <h1 className="page-title">Заголовок страницы</h1>
          </div>
          <div>
            <p className="dim ui-kit-meta">SectionTitle · --text-section-*</p>
            <SectionTitle
              action={
                <Link to="/app/profile" className="section-action">
                  Действие
                </Link>
              }
            >
              Заголовок блока
            </SectionTitle>
          </div>
          <div>
            <p className="dim ui-kit-meta">body / .muted / .dim</p>
            <p>Обычный текст — Manrope.</p>
            <p className="muted">Muted — пояснения и подписи.</p>
            <p className="dim">Dim — метаданные, счётчики, quiet-иконки.</p>
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
          Как в истории тренировок: слева переход по заголовку (без ›), справа quiet copy, снизу
          отдельная полоса expand. Не открывай детали кликом по всему ряду, если есть навигация.
        </p>
        <div className="ui-kit-list-demo workouts-board">
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
        <SectionTitle>Чипы и пиллы</SectionTitle>
        <p className="muted ui-kit-section-lead">
          Чипы — метки и фильтры. Не как главные CTA раздела — для переходов бери{' '}
          <code>.btn</code> или tool-link.
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
          Карточка: <code>.surface</code> + контент. Заголовок блока — только{' '}
          <code>SectionTitle</code>.
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
