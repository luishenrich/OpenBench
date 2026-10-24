// Small form controls for the settings page.
import { useEffect, useState, type ReactNode } from 'react'

/** Page header for Settings and Connections: the use-case list's compact h1 with an inline summary. */
export const HEADER = 'flex min-h-9 flex-wrap items-center gap-x-4 gap-y-1'

/** One settings block: title and helper text on the left, controls on the right. */
export function SettingsSection({ id, title, help, children }: { id?: string; title: string; help: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="grid gap-x-12 gap-y-4 border-t border-line py-8 md:grid-cols-[260px_minmax(0,1fr)]">
      <div>
        <h2 className="title text-base">{title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted text-pretty">{help}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  )
}

export const inputCls =
  'rounded-md border border-line bg-bg px-2.5 py-1.5 text-sm text-fg placeholder:text-faint hover:border-line-strong focus:border-line-strong focus:outline-none'

/**
 * Number input that lets you type freely ("0.", "") and reports a number, or null when empty.
 * Re-syncs when the value changes from outside (Discard).
 */
export function NumberField({
  value, onChange, unit, prefix, placeholder = 'Not set', step = 'any', min, label, width = 'w-28',
}: {
  value: number | null
  onChange: (v: number | null) => void
  unit?: string
  prefix?: string
  placeholder?: string
  step?: string
  min?: number
  label: string
  width?: string
}) {
  const [text, setText] = useState(value == null ? '' : String(value))
  useEffect(() => {
    const parsed = text.trim() === '' ? null : Number(text)
    if (parsed !== value) setText(value == null ? '' : String(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <span className={`inline-flex items-center rounded-md border border-line bg-bg focus-within:border-line-strong hover:border-line-strong`}>
      {prefix && <span className="pl-2.5 text-sm text-faint">{prefix}</span>}
      <input
        type="number"
        inputMode="decimal"
        aria-label={label}
        value={text}
        step={step}
        min={min}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value)
          const t = e.target.value.trim()
          if (t === '') onChange(null)
          else if (Number.isFinite(Number(t))) onChange(Number(t))
        }}
        className={`${width} bg-transparent px-2.5 py-1.5 text-sm text-fg tabular-nums placeholder:text-faint focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${prefix ? 'pl-1' : ''}`}
      />
      {unit && <span className="pr-2.5 text-sm text-faint">{unit}</span>}
    </span>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors ${
        checked ? 'border-front/60 bg-front/80' : 'border-line-strong bg-raised'
      }`}
    >
      <span className={`size-3.5 rounded-full bg-fg transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
    </button>
  )
}

/** A row label with an optional hint under it, and the control on the right. */
export function Row({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <div className="text-sm text-fg">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-faint">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
