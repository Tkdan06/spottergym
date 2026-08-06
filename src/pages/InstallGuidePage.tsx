import { useRef, useState } from 'react'
import { ArrowLeft, Share, Smartphone } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import './InstallGuidePage.css'

type SectionId = 'safari' | 'chrome-ios' | 'chrome-android'

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'safari', label: 'Safari · iPhone' },
  { id: 'chrome-ios', label: 'Chrome · iPhone' },
  { id: 'chrome-android', label: 'Chrome · Android' },
]

export function InstallGuidePage() {
  const navigate = useNavigate()
  /** Highlight only after the user taps a jump chip — never auto-pick on entry */
  const [active, setActive] = useState<SectionId | null>(null)
  const safariRef = useRef<HTMLElement>(null)
  const chromeIosRef = useRef<HTMLElement>(null)
  const chromeAndroidRef = useRef<HTMLElement>(null)

  const refFor = (id: SectionId) => {
    if (id === 'safari') return safariRef.current
    if (id === 'chrome-ios') return chromeIosRef.current
    return chromeAndroidRef.current
  }

  const scrollTo = (id: SectionId) => {
    setActive(id)
    refFor(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const goBack = () => {
    // Always pop history — never push /notifications again (that trapped users in install ↔ notifications)
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate('/app/notifications')
  }

  return (
    <main className="page install-guide-page">
      <button type="button" className="back-link" onClick={goBack}>
        <ArrowLeft size={18} /> Назад
      </button>

      <header className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">Ярлык на экран</h1>
          <p className="muted install-guide-lead">
            Добавь Spotter на домашний экран — так удобнее заходить и работают пуши. Шаги зависят от
            браузера и телефона.
          </p>
        </div>
      </header>

      <nav className="install-guide-nav filter-row" aria-label="Быстрый переход к браузеру">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`chip ${active === s.id ? 'active' : ''}`}
            onClick={() => scrollTo(s.id)}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <section
        ref={safariRef}
        id="install-safari"
        className="surface install-guide-section"
        aria-labelledby="install-safari-title"
      >
        <div className="install-guide-section-head">
          <Smartphone size={22} aria-hidden />
          <h2 id="install-safari-title">Safari · iPhone</h2>
        </div>
        <p className="muted">
          Самый простой путь на iPhone. Пуши работают только из ярлыка на экране (не из вкладки
          браузера).
        </p>
        <ol className="install-guide-steps">
          <li>
            Открой <strong>spottergym.ru</strong> в <strong>Safari</strong>.
          </li>
          <li>
            Нажми <strong>Поделиться</strong>
            <span className="install-guide-share" aria-hidden>
              <Share size={14} />
            </span>
            — квадрат со стрелкой вверх. На новых iPhone: меню <strong>···</strong> у адресной строки
            → <strong>Поделиться</strong>.
          </li>
          <li>
            Выбери <strong>На экран «Домой»</strong>. Если пункта нет — <strong>Править действия…</strong>{' '}
            и включи его.
          </li>
          <li>
            Оставь название <strong>SPOTTER</strong>. Если есть{' '}
            <strong>Открывать как веб-приложение</strong> — оставь включённым.
          </li>
          <li>
            Нажми <strong>Добавить</strong>. Запусти Spotter с домашнего экрана и включи пуши в
            колокольчике.
          </li>
        </ol>
      </section>

      <section
        ref={chromeIosRef}
        id="install-chrome-ios"
        className="surface install-guide-section"
        aria-labelledby="install-chrome-ios-title"
      >
        <div className="install-guide-section-head">
          <Smartphone size={22} aria-hidden />
          <h2 id="install-chrome-ios-title">Chrome · iPhone</h2>
        </div>
        <p className="muted">
          На iPhone у Chrome другой путь, чем на Android: ярлык ставится через «Поделиться», как в
          Safari. Пуши — только после открытия с домашнего экрана.
        </p>
        <ol className="install-guide-steps">
          <li>
            Открой <strong>spottergym.ru</strong> в <strong>Chrome</strong> на iPhone.
          </li>
          <li>
            Нажми <strong>Поделиться</strong>
            <span className="install-guide-share" aria-hidden>
              <Share size={14} />
            </span>
            внизу или в меню Chrome (квадрат со стрелкой / «Поделиться…»).
          </li>
          <li>
            В списке выбери <strong>На экран «Домой»</strong>. Если пункта нет — прокрути вниз или
            нажми <strong>Ещё</strong> / <strong>Править действия…</strong>.
          </li>
          <li>
            Подтверди название <strong>SPOTTER</strong> → <strong>Добавить</strong>.
          </li>
          <li>
            Важно: открой Spotter <strong>с иконки на экране</strong> (не из вкладки Chrome) и
            включи пуши в колокольчике → Настройки.
          </li>
        </ol>
        <p className="dim install-guide-aside">
          Не получается найти пункт? Открой тот же адрес в Safari и поставь ярлык оттуда — на iPhone
          это тот же результат.
        </p>
      </section>

      <section
        ref={chromeAndroidRef}
        id="install-chrome-android"
        className="surface install-guide-section"
        aria-labelledby="install-chrome-android-title"
      >
        <div className="install-guide-section-head">
          <Smartphone size={22} aria-hidden />
          <h2 id="install-chrome-android-title">Chrome · Android</h2>
        </div>
        <p className="muted">
          Здесь ярлык ставится из меню Chrome (три точки), не через «Поделиться».
        </p>
        <ol className="install-guide-steps">
          <li>
            Открой <strong>spottergym.ru</strong> в <strong>Chrome</strong>.
          </li>
          <li>
            Нажми <strong>⋮</strong> в правом верхнем углу.
          </li>
          <li>
            Выбери <strong>Установить приложение</strong> или <strong>Добавить на главный экран</strong>{' '}
            / <strong>На главный экран</strong> — зависит от версии Chrome.
          </li>
          <li>
            Подтверди <strong>Установить</strong> или <strong>Добавить</strong>.
          </li>
          <li>
            Запусти Spotter с домашнего экрана или из списка приложений и включи пуши в колокольчике
            → Настройки.
          </li>
        </ol>
      </section>

      <p className="dim install-guide-note">
        Уже с ярлыка? Вернись в уведомления и включи пуши одним переключателем.
      </p>
    </main>
  )
}
