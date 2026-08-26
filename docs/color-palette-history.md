# История палитр Spotter

Живые токены — только в `src/styles/color-themes.css` (`:root`). Этот файл — архив, если нужно «вернуться к исходникам».

С августа 2026 в продукте одна палитра: бывший админский превью **v2**. Переключатель «Новая палитра» в админке снят.

Графики и бары (`--progress`) в проде — lime (`--accent`), не синий. Синий `#5e9cff` был только в черновике v2 и не ушёл в продакшен.

## Сейчас в коде (бывший v2)

| Токен | Hex / значение |
|---|---|
| `--bg` | `#0a0d0c` |
| `--bg-elevated` | `#101513` |
| `--bg-soft` | `#1b231f` |
| `--bg-card` | `#151b18` |
| `--bg-wash-top` | `#0a0d0c` |
| `--bg-wash-bottom` | `#0a0d0c` |
| `--line` | `rgba(235, 242, 237, 0.1)` |
| `--line-strong` | `rgba(235, 242, 237, 0.16)` |
| `--text` | `#eef5ef` |
| `--text-muted` | `#a1ada5` |
| `--text-dim` | `#748179` |
| `--text-disabled` | `#4f5a54` |
| `--accent` | `#c8f542` |
| `--accent-ink` | `#13200a` |
| `--accent-soft` | `rgba(200, 245, 66, 0.12)` |
| `--accent-soft-strong` | `rgba(200, 245, 66, 0.2)` |
| `--danger` | `#ff5263` |
| `--danger-soft` | `rgba(255, 82, 99, 0.12)` |
| `--warning` | `#ffb84d` |
| `--warning-soft` | `rgba(255, 184, 77, 0.12)` |
| `--online` | `#67efc1` |
| `--online-soft` | `rgba(103, 239, 193, 0.1)` |
| `--progress` | `var(--accent)` (`#c8f542`) |
| `--glow-lime` | `rgba(200, 245, 66, 0.04)` |
| `--glow-presence` | `transparent` |
| `theme-color` / PWA | `#0A0D0C` |

## Исходники до v2 (продакшен до раскатки)

| Токен | Hex / значение |
|---|---|
| `--bg` | `#0b0f0e` |
| `--bg-elevated` | `#121816` |
| `--bg-soft` | `#1a221e` |
| `--bg-card` | `#141b18` |
| `--bg-wash-top` | `#0d1311` |
| `--bg-wash-bottom` | `#090c0b` |
| `--line` | `rgba(232, 240, 234, 0.1)` |
| `--line-strong` | `rgba(232, 240, 234, 0.18)` |
| `--text` | `#eef5ef` |
| `--text-muted` | `#94a39a` |
| `--text-dim` | `#6b7a71` |
| `--text-disabled` | `#5a665f` |
| `--accent` | `#c8f542` |
| `--accent-ink` | `#13200a` |
| `--accent-soft` | `rgba(200, 245, 66, 0.14)` |
| `--accent-soft-strong` | `rgba(200, 245, 66, 0.2)` |
| `--danger` | `#ff6b6b` |
| `--danger-soft` | `rgba(255, 107, 107, 0.12)` |
| `--warning` | `#ffc857` |
| `--warning-soft` | `rgba(255, 200, 87, 0.12)` |
| `--online` | `#57f287` |
| `--online-soft` | `rgba(87, 242, 135, 0.1)` |
| `--progress` | `var(--accent)` |
| `--glow-lime` | `rgba(200, 245, 66, 0.08)` |
| `--glow-presence` | `rgba(87, 242, 135, 0.05)` |
| `theme-color` / PWA | `#0B0F0E` |

## Черновик v2 с синим прогрессом (не шипился)

В первом админском превью v2 графики были `--progress: #5e9cff`. Перед раскаткой это заменили на lime.

Чтобы вернуть исходники: скопируй таблицу «до v2» в `:root` в `src/styles/color-themes.css` и поправь `theme-color` в `index.html` / `public/site.webmanifest`.
