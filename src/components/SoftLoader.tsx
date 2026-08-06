import './SoftLoader.css'

type Props = {
  label?: string
  className?: string
}

/** Компактный лоадер для списков (появляется после задержки у вызывающего). */
export function SoftLoader({ label = 'Загружаем…', className = '' }: Props) {
  return (
    <div className={`soft-loader ${className}`.trim()} role="status" aria-live="polite">
      <span className="soft-loader-ring" aria-hidden />
      <p className="soft-loader-label">{label}</p>
    </div>
  )
}
