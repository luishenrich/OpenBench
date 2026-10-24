// Small shared pieces for the use-case operations: icons, a keyboard-friendly row menu, a confirm dialog,
// toasts and a clipboard helper. No dependencies.
import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'

// --- icons (16 px grid, stroke) ---------------------------------------------
const PATHS = {
  dots: 'M3.5 8h.01M8 8h.01M12.5 8h.01',
  pencil: 'M10.5 3.5l2 2L6 12H4v-2l6.5-6.5z',
  pin: 'M6 2.5h4M7 2.5v4L4.5 9h7L9 6.5v-4M8 9v4.5',
  trash: 'M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5',
  copy: 'M5.5 5.5V3h7.5v7.5h-2.5M3 5.5h7.5V13H3z',
  check: 'M3.5 8.5l3 3 6-6.5',
  search: 'M7 12a5 5 0 100-10 5 5 0 000 10zM10.5 10.5L14 14',
  x: 'M4 4l8 8M12 4l-8 8',
  plus: 'M8 3v10M3 8h10',
  duplicate: 'M5.5 5.5h7.5V13H5.5zM3 10.5V3h7.5',
  agent: 'M3 4h10v7H8l-3 2.5V11H3z',
} as const
export type IconName = keyof typeof PATHS

export function Icon({ name, className = 'size-4', filled = false }: { name: IconName; className?: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden>
      <path d={PATHS[name]} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={name === 'dots' ? 2.2 : 1.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-0'

// --- row menu ---------------------------------------------------------------
export interface MenuItem { label: string; icon?: IconName; onSelect: () => void; danger?: boolean; hint?: string }

/** "⋯" button with a menu: Enter/Space/ArrowDown open it, arrows move, Esc closes and returns focus. */
export function RowMenu({ items, label, className = '' }: { items: MenuItem[]; label: string; className?: string }) {
  const [open, setOpen] = useState(false)
  // fixed position, so the menu is never clipped by a rounded, overflow-hidden list
  const [pos, setPos] = useState<{ top: number; right: number; up: boolean }>({ top: 0, right: 0, up: false })
  const btn = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    list.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus()
    const close = (e: MouseEvent) => {
      if (!list.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false)
    }
    // follow the button while the page scrolls; close once it leaves the viewport
    const follow = () => {
      const r = btn.current?.getBoundingClientRect()
      if (!r || r.bottom < 0 || r.top > window.innerHeight) setOpen(false)
      else place()
    }
    document.addEventListener('mousedown', close)
    window.addEventListener('scroll', follow, true)
    window.addEventListener('resize', follow)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', follow, true)
      window.removeEventListener('resize', follow)
    }
  }, [open])
  function place() {
    const r = btn.current?.getBoundingClientRect()
    if (!r) return
    const up = window.innerHeight - r.bottom < items.length * 32 + 24
    setPos({ top: up ? r.top - 4 : r.bottom + 4, right: window.innerWidth - r.right, up })
  }
  function toggle() {
    place()
    setOpen((o) => !o)
  }

  function onKey(e: React.KeyboardEvent) {
    const els = [...(list.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [])]
    const i = els.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'ArrowDown') { e.preventDefault(); els[(i + 1) % els.length]?.focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus() }
    else if (e.key === 'Home') { e.preventDefault(); els[0]?.focus() }
    else if (e.key === 'End') { e.preventDefault(); els.at(-1)?.focus() }
    else if (e.key === 'Escape' || e.key === 'Tab') { setOpen(false); if (e.key === 'Escape') btn.current?.focus() }
  }

  return (
    <div className={`relative ${className}`}>
      <button
        ref={btn} type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle() }}
        onKeyDown={(e) => { if (e.key === 'ArrowDown' && !open) { e.preventDefault(); toggle() } }}
        className={`grid size-7 place-items-center rounded-md text-faint transition-colors hover:bg-raised hover:text-fg ${open ? 'bg-raised text-fg' : ''} ${focusRing}`}
      >
        <Icon name="dots" />
      </button>
      {open && (
        <div
          ref={list} id={id} role="menu" aria-label={label} onKeyDown={onKey}
          style={{ top: pos.top, right: pos.right, transform: pos.up ? 'translateY(-100%)' : undefined }}
          className="fixed z-40 min-w-[180px] overflow-hidden rounded-lg border border-line bg-raised py-1 shadow-xl shadow-black/40"
        >
          {items.map((it) => (
            <button
              key={it.label} role="menuitem" type="button" tabIndex={-1}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(false); it.onSelect() }}
              className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] outline-none hover:bg-line focus:bg-line ${it.danger ? 'text-bad' : 'text-fg'}`}
            >
              {it.icon && <Icon name={it.icon} className="size-3.5 shrink-0 opacity-80" />}
              <span className="flex-1">{it.label}</span>
              {it.hint && <span className="text-[11px] text-faint">{it.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// --- confirm dialog ---------------------------------------------------------
export function ConfirmDialog({ open, title, body, confirmLabel, onConfirm, onCancel, busy = false }: {
  open: boolean; title: string; body: ReactNode; confirmLabel: string; onConfirm: () => void; onCancel: () => void; busy?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref} onCancel={(e) => { e.preventDefault(); onCancel() }}
      className="m-auto w-[min(440px,calc(100vw-32px))] rounded-xl border border-line bg-panel p-0 text-fg backdrop:bg-black/60"
    >
      <div className="p-5">
        <h2 className="title text-lg">{title}</h2>
        <div className="mt-2 text-sm text-muted">{body}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className={`rounded-md px-3.5 py-2 text-sm text-muted hover:bg-raised hover:text-fg ${focusRing}`}>Cancel</button>
          <button
            type="button" onClick={onConfirm} disabled={busy} autoFocus
            className={`rounded-md border border-bad/50 bg-bad/15 px-3.5 py-2 text-sm font-medium text-bad hover:bg-bad/25 disabled:opacity-60 ${focusRing}`}
          >
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}

// --- toasts (module store, so a toast survives navigating from the page back to the list) --------------
type Toast = { id: number; text: string; tone: 'plain' | 'bad' }
let toasts: Toast[] = []
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())
export function toast(text: string, tone: Toast['tone'] = 'plain') {
  const t = { id: Date.now() + Math.random(), text, tone }
  toasts = [...toasts, t]
  emit()
  setTimeout(() => { toasts = toasts.filter((x) => x.id !== t.id); emit() }, 4200)
}
export function Toaster() {
  const list = useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => toasts)
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col items-end gap-2" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`pointer-events-auto rounded-lg border bg-raised px-3.5 py-2 text-sm shadow-xl shadow-black/40 ${t.tone === 'bad' ? 'border-bad/50 text-bad' : 'border-line text-fg'}`}>
          {t.text}
        </div>
      ))}
    </div>
  )
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // clipboard blocked (http, permissions): fall back to a hidden textarea
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}

export function Checkbox({ checked, indeterminate = false, onChange, label, className = '' }: {
  checked: boolean; indeterminate?: boolean; onChange: (v: boolean) => void; label: string; className?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate }, [indeterminate])
  return (
    <input
      ref={ref} type="checkbox" aria-label={label} checked={checked}
      onClick={(e) => e.stopPropagation()} onChange={(e) => onChange(e.target.checked)}
      className={`size-3.5 cursor-pointer accent-[var(--color-front)] ${focusRing} ${className}`}
    />
  )
}
