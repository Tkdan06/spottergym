import { useEffect } from 'react'

function isTextInput(el: Element | null) {
  return (
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLInputElement &&
      !['button', 'checkbox', 'radio', 'range', 'submit'].includes(el.type)) ||
    (el instanceof HTMLElement && el.isContentEditable)
  )
}

/**
 * Sets a CSS var from the visual viewport keyboard overlap.
 *
 * Some iOS PWAs shrink both `innerHeight` and `visualViewport.height` when
 * the keyboard opens. Keeping the last unfocused visual height lets sheets
 * still detect that lost area instead of reporting a false 0px inset.
 */
export function useKeyboardInset(cssVar = '--form-keyboard') {
  useEffect(() => {
    if (!cssVar) return
    const root = document.documentElement
    let restingVisible = Math.round(window.visualViewport?.height ?? window.innerHeight)
    const timers: number[] = []

    const sync = () => {
      const vv = window.visualViewport
      if (!vv) {
        root.style.setProperty(cssVar, '0px')
        return
      }
      const visible = Math.round(vv.height)
      const focused = isTextInput(document.activeElement)
      if (!focused) restingVisible = visible

      const layoutOverlap = Math.max(0, window.innerHeight - visible - vv.offsetTop)
      const viewportLoss = focused ? Math.max(0, restingVisible - visible) : 0
      const keyboard = Math.max(layoutOverlap, viewportLoss)
      root.style.setProperty(cssVar, `${keyboard}px`)
    }

    const syncAfterKeyboardAnimation = () => {
      timers.splice(0).forEach((id) => window.clearTimeout(id))
      sync()
      // WebKit often publishes visualViewport after focus, not before it.
      ;[50, 180, 350].forEach((ms) => timers.push(window.setTimeout(sync, ms)))
    }

    sync()
    const vv = window.visualViewport
    vv?.addEventListener('resize', sync)
    vv?.addEventListener('scroll', sync)
    window.addEventListener('resize', sync)
    document.addEventListener('focusin', syncAfterKeyboardAnimation)
    document.addEventListener('focusout', syncAfterKeyboardAnimation)
    return () => {
      timers.splice(0).forEach((id) => window.clearTimeout(id))
      vv?.removeEventListener('resize', sync)
      vv?.removeEventListener('scroll', sync)
      window.removeEventListener('resize', sync)
      document.removeEventListener('focusin', syncAfterKeyboardAnimation)
      document.removeEventListener('focusout', syncAfterKeyboardAnimation)
      root.style.removeProperty(cssVar)
    }
  }, [cssVar])
}
