import { useEffect } from 'react'

/**
 * Sets a CSS var from visualViewport keyboard overlap (same idea as chat).
 * Use on long forms / report sheets so the focused field stays above the keyboard.
 */
export function useKeyboardInset(cssVar = '--form-keyboard') {
  useEffect(() => {
    if (!cssVar) return
    const root = document.documentElement
    const sync = () => {
      const vv = window.visualViewport
      if (!vv) {
        root.style.setProperty(cssVar, '0px')
        return
      }
      const keyboard = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      root.style.setProperty(cssVar, `${keyboard}px`)
    }
    sync()
    const vv = window.visualViewport
    vv?.addEventListener('resize', sync)
    vv?.addEventListener('scroll', sync)
    window.addEventListener('resize', sync)
    return () => {
      vv?.removeEventListener('resize', sync)
      vv?.removeEventListener('scroll', sync)
      window.removeEventListener('resize', sync)
      root.style.removeProperty(cssVar)
    }
  }, [cssVar])
}
