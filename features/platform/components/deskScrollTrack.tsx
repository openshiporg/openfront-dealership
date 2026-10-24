'use client'

import * as React from 'react'

const FADE = '24px'

/**
 * A horizontally scrolling track for the desk kit's segmented controls. When the choices overflow,
 * the clipped edge fades out so the track reads as scrollable, and the selected pill is kept in view.
 */
export function ScrollFadeTrack({
  className,
  children,
  activeKey,
  style,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { activeKey?: string }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [edges, setEdges] = React.useState({ start: false, end: false })

  const measure = React.useCallback(() => {
    const element = ref.current
    if (!element) return
    const max = element.scrollWidth - element.clientWidth
    const next = { start: element.scrollLeft > 1, end: max - element.scrollLeft > 1 }
    setEdges(current => (current.start === next.start && current.end === next.end ? current : next))
  }, [])

  React.useEffect(() => {
    const element = ref.current
    if (!element) return
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    Array.from(element.children).forEach(child => observer.observe(child))
    return () => observer.disconnect()
  }, [measure, children])

  // Bring the selected choice into view without moving the page vertically.
  React.useEffect(() => {
    const element = ref.current
    const active = element?.querySelector<HTMLElement>('[data-active="true"]')
    if (!element || !active || element.scrollWidth <= element.clientWidth) return
    const left = active.getBoundingClientRect().left - element.getBoundingClientRect().left + element.scrollLeft
    const right = left + active.offsetWidth
    const pad = 24
    if (left - pad < element.scrollLeft) element.scrollLeft = Math.max(0, left - pad)
    else if (right + pad > element.scrollLeft + element.clientWidth) element.scrollLeft = right + pad - element.clientWidth
    measure()
  }, [activeKey, measure])

  const mask = edges.start || edges.end
    ? `linear-gradient(to right, ${edges.start ? 'transparent' : '#000'} 0, #000 ${edges.start ? FADE : '0px'}, #000 calc(100% - ${edges.end ? FADE : '0px'}), ${edges.end ? 'transparent' : '#000'} 100%)`
    : undefined

  return (
    <div
      ref={ref}
      onScroll={measure}
      data-overflow-start={edges.start ? 'true' : undefined}
      data-overflow-end={edges.end ? 'true' : undefined}
      className={className}
      style={mask ? { ...style, maskImage: mask, WebkitMaskImage: mask } : style}
      {...props}
    >
      {children}
    </div>
  )
}
