import { useEffect, useRef, useState, type CSSProperties } from 'react'

// Landing-only motion helpers. Everything here degrades to the final, fully visible state:
// hidden "before" states live in landing.css under prefers-reduced-motion: no-preference and
// only apply while [data-inview="false"], so no IntersectionObserver (or reduced motion) means no hiding.

/** True once the element has scrolled into view (fires once). Without IntersectionObserver it is true at once. */
export function useInView<T extends Element>(threshold = 0.25, rootMargin = '0px 0px -8% 0px') {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true)
          io.disconnect()
        }
      },
      { threshold, rootMargin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [threshold, rootMargin])
  return [ref, inView] as const
}

/** Cursor-follow spotlight: writes the pointer position into --mx / --my on the element (no React re-render). */
export function useSpotlight<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    let frame = 0
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect()
        el.style.setProperty('--mx', `${e.clientX - r.left}px`)
        el.style.setProperty('--my', `${e.clientY - r.top}px`)
      })
    }
    el.addEventListener('pointermove', move)
    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener('pointermove', move)
    }
  }, [])
  return ref
}

/** Inline delay for staggered children: style={d(i * 60)}. */
export const d = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties
