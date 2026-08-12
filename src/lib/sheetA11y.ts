import { type RefObject, useEffect } from 'react'

/**
 * Focus trap + inert background for modal sheets (matches Messages pin sheet).
 * `panelRef` must point at the dialog panel that contains focusable controls.
 */
export function useSheetA11y(
  open: boolean,
  onClose: () => void,
  panelRef: RefObject<HTMLElement | null>,
  initialFocusRef?: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const restoreFocus = document.activeElement as HTMLElement | null
    const inertNodes: Element[] = []

    const markInert = (el: Element | null | undefined) => {
      if (!el || el.hasAttribute('inert')) return
      el.setAttribute('inert', '')
      inertNodes.push(el)
    }

    const panel = panelRef.current
    const sheetRoot =
      panel?.closest(
        '.schedule-sheet, .checkin-sheet, .chat-pin-sheet, .safety-sheet, .floor-sheet, .city-sheet, .photo-modal, [data-sheet-root]',
      ) || panel

    markInert(document.querySelector('.bottom-nav'))

    const appMain = document.querySelector('.app-main')
    if (sheetRoot && appMain?.contains(sheetRoot)) {
      let current: Element | null = sheetRoot
      while (current && current !== document.body) {
        const parent: Element | null = current.parentElement
        if (!parent) break
        const siblings: Element[] = Array.from(parent.children)
        for (const sibling of siblings) {
          if (sibling !== current) markInert(sibling)
        }
        if (parent === appMain || parent.classList.contains('app-shell')) break
        current = parent
      }
    } else {
      // Portaled outside the shell
      markInert(document.querySelector('.app-shell'))
    }

    const focusTimer = window.setTimeout(() => {
      const target =
        initialFocusRef?.current ||
        panelRef.current?.querySelector<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )
      target?.focus()
    }, 0)

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const root = panelRef.current
      if (!root) return
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.tabIndex !== -1 && !el.hasAttribute('disabled'))
      if (!focusables.length) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault()
          last.focus()
        }
      } else if (active === last || !root.contains(active)) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(focusTimer)
      document.body.style.overflow = prevOverflow
      for (const node of inertNodes) node.removeAttribute('inert')
      window.removeEventListener('keydown', onKey)
      restoreFocus?.focus?.()
    }
  }, [open, onClose, panelRef, initialFocusRef])
}
