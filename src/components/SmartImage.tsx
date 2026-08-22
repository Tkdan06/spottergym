import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ImgHTMLAttributes,
} from 'react'
import { optimizeImageUrl, type ImageSize } from '../lib/imageUrl'
import './SmartImage.css'

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'loading' | 'decoding'> & {
  src: string
  alt: string
  /** Локальный запасной URL, если основной не загрузился */
  fallbackSrc?: string
  /** Слот для сжатия CDN-URL */
  size?: ImageSize
  /** LCP / above-the-fold: без lazy, высокий приоритет */
  priority?: boolean
  /** No fade — paint as soon as the bytes are there */
  instant?: boolean
}

const SIZES_ATTR: Record<ImageSize, string> = {
  avatar: '96px',
  thumb: '160px',
  card: '104px',
  hero: '100vw',
  full: '100vw',
}

/**
 * Единая картинка: lazy + async decode + fade-in + ужатие CDN под слот.
 */
export function SmartImage({
  src,
  alt,
  fallbackSrc,
  size = 'card',
  priority = false,
  instant = false,
  className = '',
  onLoad,
  onError,
  sizes,
  ...rest
}: Props) {
  const optimized = useMemo(() => optimizeImageUrl(src, size), [src, size])
  const optimizedFallback = useMemo(
    () => (fallbackSrc ? optimizeImageUrl(fallbackSrc, size) : ''),
    [fallbackSrc, size],
  )
  const [activeSrc, setActiveSrc] = useState(optimized)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const triedFallback = useRef(false)

  useLayoutEffect(() => {
    setActiveSrc(optimized)
    setLoaded(false)
    setFailed(false)
    triedFallback.current = false
  }, [optimized])

  useLayoutEffect(() => {
    const el = imgRef.current
    if (el?.complete && el.naturalWidth > 0) setLoaded(true)
  }, [activeSrc])

  if (!activeSrc || failed) {
    return (
      <span
        className={`smart-image smart-image--empty ${className}`.trim()}
        aria-hidden={alt ? undefined : true}
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
      />
    )
  }

  return (
    <img
      {...rest}
      ref={imgRef}
      src={activeSrc}
      alt={alt}
      className={`smart-image ${loaded ? 'is-loaded' : ''} ${priority ? 'is-priority' : ''} ${instant ? 'is-instant' : ''} ${className}`.trim()}
      loading={priority || instant ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority || instant ? 'high' : 'auto'}
      sizes={sizes ?? SIZES_ATTR[size]}
      onLoad={(e) => {
        setLoaded(true)
        onLoad?.(e)
      }}
      onError={(e) => {
        if (
          optimizedFallback &&
          !triedFallback.current &&
          activeSrc !== optimizedFallback
        ) {
          triedFallback.current = true
          setLoaded(false)
          setActiveSrc(optimizedFallback)
          return
        }
        setFailed(true)
        onError?.(e)
      }}
    />
  )
}
