export const DIALOG_FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function isEscapeKey(key: string) {
  return key === 'Escape'
}

export function dialogFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(DIALOG_FOCUSABLE_SELECTOR))
    .filter(element => element.tabIndex >= 0 && element.getAttribute('aria-hidden') !== 'true')
}

export function trapDialogFocus(
  event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'preventDefault'>,
  container: HTMLElement
) {
  if (event.key !== 'Tab') return false

  const focusable = dialogFocusableElements(container)
  if (focusable.length === 0) {
    event.preventDefault()
    container.focus()
    return true
  }

  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  const active = container.ownerDocument.activeElement
  const activeInside = active ? container.contains(active) : false

  if (event.shiftKey && (!activeInside || active === first)) {
    event.preventDefault()
    last.focus()
    return true
  }
  if (!event.shiftKey && (!activeInside || active === last)) {
    event.preventDefault()
    first.focus()
    return true
  }
  return false
}

type InertNode = HTMLElement & {
  parentElement: InertNode | null
  children: HTMLCollectionOf<InertNode>
}

/**
 * Inert every sibling branch from the dialog to the document root. This keeps
 * a nested fixed overlay interactive while making the rest of the page
 * unfocusable, without hiding or deleting background content.
 */
export function inertOutsideDialog(dialogRoot: HTMLElement) {
  const changed = new Map<InertNode, boolean>()
  let branch = dialogRoot as InertNode
  let parent = branch.parentElement

  while (parent) {
    for (const sibling of Array.from(parent.children)) {
      if (sibling === branch || changed.has(sibling)) continue
      changed.set(sibling, sibling.inert)
      sibling.inert = true
    }
    branch = parent
    parent = parent.parentElement
  }

  return () => {
    for (const [element, wasInert] of changed) element.inert = wasInert
  }
}

export function restoreFocusAfterClose(
  target: Pick<HTMLElement, 'focus'> | null | undefined,
  schedule: (callback: () => void) => void = callback => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(callback)
    else callback()
  }
) {
  if (!target) return
  schedule(() => target.focus())
}
