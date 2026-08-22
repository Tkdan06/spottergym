import { type RefObject, useEffect, useRef } from 'react'

type SheetA11yOptions = {
  /** When false, only focus the panel container (no control autofocus / no keyboard). Default true. */
  autoFocus?: boolean
}

/**
 * Focus trap + inert background for modal sheets (matches Messages pin sheet).
 * `panelRef` must point at the dialog panel that contains focusable controls.
 *
 * `onClose` is read from a ref so typing / parent re-renders do not re-arm the effect
 * (re-focusing the panel would dismiss the iOS keyboard).
 */
export function useSheetA11y(
  open: boolean,
  onClose: () => void,
  panelRef: RefObject<HTMLElement | null>,
  initialFocusRef?: RefObject<HTMLElement | null>,
  options?: SheetA11yOptions,
) {
  const autoFocus = options?.autoFocus !== false
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return

    let cancelled = false
    let focusTimer = 0
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const restoreFocus = document.activeElement as HTMLElement | null
    const inertNodes: Element[] = []

    const markInert = (el: Element | null | undefined) => {
      if (!el || el.hasAttribute('inert')) return
      el.setAttribute('inert', '')
      inertNodes.push(el)
    }

    const focusEl = (el: HTMLElement) => {
      el.focus({ preventScroll: true })
    }

    const applyInertTree = (sheetRoot: Element) => {
      markInert(document.querySelector('.bottom-nav'))

      let current: Element | null = sheetRoot
      while (current && current !== document.body) {
        const parent: Element | null = current.parentElement
        if (!parent) break
        const siblings: Element[] = Array.from(parent.children)
        for (const sibling of siblings) {
          if (sibling !== current) markInert(sibling)
        }
        if (
          parent.classList.contains('app-shell') ||
          parent.classList.contains('app-main') ||
          parent.classList.contains('page')
        ) {
          break
        }
        current = parent
      }
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const root = panelRef.current
      if (!root) return
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.tabIndex !== -1 && !el.hasAttribute('disabled'))
      if (!focusables.length) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault()
          focusEl(last)
        }
      } else if (active === last || !root.contains(active)) {
        e.preventDefault()
        focusEl(first)
      }
    }

    window.addEventListener('keydown', onKey)

    const arm = () => {
      if (cancelled) return
      const panel = panelRef.current
      if (!panel) {
        focusTimer = window.setTimeout(arm, 0)
        return
      }
      const sheetRoot =
        panel.closest(
          '.app-sheet, .schedule-sheet, .checkin-sheet, .chat-pin-sheet, .safety-sheet, .floor-sheet, .city-sheet, .photo-modal, [data-sheet-root]',
        ) || panel
      applyInertTree(sheetRoot)

      panel.setAttribute('tabindex', '-1')

      // Never steal focus from an input/textarea the user already activated
      const active = document.activeElement as HTMLElement | null
      if (
        active &&
        panel.contains(active) &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.isContentEditable)
      ) {
        return
      }

      if (!autoFocus) {
        // Keep focus in the dialog without focusing inputs that open the keyboard
        if (!active || !panel.contains(active)) focusEl(panel)
        return
      }

      const target = initialFocusRef?.current
      if (
        target &&
        target.tagName !== 'INPUT' &&
        target.tagName !== 'TEXTAREA'
      ) {
        focusEl(target)
        return
      }

      const fallback = panel.querySelector<HTMLElement>(
        'button:not([disabled]), [href], [data-sheet-initial-focus]',
      )
      if (fallback && fallback.tagName !== 'INPUT' && fallback.tagName !== 'TEXTAREA') {
        focusEl(fallback)
      } else {
        focusEl(panel)
      }
    }
    arm()

    return () => {
      cancelled = true
      window.clearTimeout(focusTimer)
      document.body.style.overflow = prevOverflow
      for (const node of inertNodes) node.removeAttribute('inert')
      window.removeEventListener('keydown', onKey)
      // Only restore if focus is still inside this panel (avoid yanking focus mid-type)
      const active = document.activeElement as HTMLElement | null
      const panel = panelRef.current
      const stillInPanel = Boolean(panel && active && panel.contains(active))
      if (!stillInPanel && restoreFocus && typeof restoreFocus.focus === 'function') {
        try {
          restoreFocus.focus({ preventScroll: true })
        } catch {
          /* ignore */
        }
      }
    }
  }, [open, panelRef, initialFocusRef, autoFocus])
}
