import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui'
import { Icon, copyText, focusRing } from '@/components/usecases/kit'
import { LiveDot } from '@/components/usecases/live'
import { CASES_DEFAULT, CASES_MAX, CASES_MIN, caseAgentInstruction } from '@/components/usecases/ops'
import type { UseCase } from '@/types'

export const AGENT_BUSY_REASON = "Your agent is still setting this use case up. Wait until it's done, so two agents don't write at the same time."

const clamp = (v: string) => Math.min(CASES_MAX, Math.max(CASES_MIN, Math.round(Number(v)) || CASES_DEFAULT))

function Chevron({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`size-3.5 ${className}`} aria-hidden>
      <path d="M4.5 6.5L8 10l3.5-3.5" />
    </svg>
  )
}

/**
 * "Add case" as a choice: add one manually (the drawer), or copy an instruction for the coding agent.
 * While the agent is still setting the use case up, only the manual way is open.
 */
export default function AddCaseMenu({ uc, agentBusy, onManual }: { uc: UseCase; agentBusy: boolean; onManual: () => void }) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'choice' | 'agent'>('choice')
  const root = useRef<HTMLDivElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const id = useId()

  const close = (refocus = false) => {
    setOpen(false)
    setView('choice')
    if (refocus) root.current?.querySelector<HTMLButtonElement>('button')?.focus()
  }

  // the agent started (again) while the panel was open: back to the choice, where the reason shows
  useEffect(() => { if (agentBusy && view === 'agent') setView('choice') }, [agentBusy, view])

  useEffect(() => {
    if (!open) return
    const outside = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) close() }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(true) } }
    document.addEventListener('mousedown', outside)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', outside)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const el = view === 'choice'
      ? pop.current?.querySelector<HTMLElement>('[role=menuitem]')
      : pop.current?.querySelector<HTMLElement>('input')
    el?.focus({ preventScroll: true })
    // keep all of it on screen; the ::after spacer lets the page scroll a little past it at the bottom
    pop.current?.scrollIntoView({ block: 'nearest' })
  }, [open, view])

  function onMenuKey(e: React.KeyboardEvent) {
    if (view !== 'choice') return
    const els = [...(pop.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [])]
    const i = els.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'ArrowDown') { e.preventDefault(); els[(i + 1) % els.length]?.focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus() }
    else if (e.key === 'Tab') close()
  }

  const item = 'flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left outline-none'

  return (
    <div ref={root} className="relative">
      <Button
        aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={(e) => { if (e.key === 'ArrowDown' && !open) { e.preventDefault(); setOpen(true) } }}
      >
        <Icon name="plus" className="size-3.5" />Add case<Chevron className={`-mr-1 transition-transform ${open ? 'rotate-180' : ''}`} />
      </Button>

      {open && (
        <div
          ref={pop} id={id} onKeyDown={onMenuKey}
          role={view === 'choice' ? 'menu' : 'dialog'} aria-label={view === 'choice' ? 'Add case' : 'Ask your agent'}
          className={`absolute top-full right-0 z-30 mt-1.5 scroll-mb-6 rounded-lg after:pointer-events-none after:absolute after:top-full after:h-6 after:w-px after:content-[''] border border-line bg-raised shadow-xl shadow-black/40 ${view === 'choice' ? 'w-[340px] p-1' : 'w-[520px]'}`}
        >
          {view === 'choice' ? (
            <>
              <button type="button" role="menuitem" tabIndex={-1} className={`${item} hover:bg-line focus:bg-line`} onClick={() => { close(); onManual() }}>
                <Icon name="pencil" className="mt-0.5 size-4 shrink-0 text-muted" />
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-fg">Add manually</span>
                  <span className="mt-0.5 block text-xs text-muted">Fill in one case: inputs, images, expected output.</span>
                </span>
              </button>
              <button
                type="button" role="menuitem" tabIndex={-1} aria-disabled={agentBusy || undefined}
                className={`${item} ${agentBusy ? 'cursor-not-allowed' : 'hover:bg-line focus:bg-line'}`}
                onClick={() => { if (!agentBusy) setView('agent') }}
              >
                <Icon name="agent" className={`mt-0.5 size-4 shrink-0 ${agentBusy ? 'text-faint' : 'text-muted'}`} />
                <span className="min-w-0">
                  <span className={`block text-[13px] font-medium ${agentBusy ? 'text-faint' : 'text-fg'}`}>Ask your agent</span>
                  {agentBusy ? (
                    <span className="mt-1 flex gap-2 text-xs text-muted"><LiveDot small className="mt-[5px]" /><span>{AGENT_BUSY_REASON}</span></span>
                  ) : (
                    <span className="mt-0.5 block text-xs text-muted">Your coding agent pulls real examples from the repo, then generates the rest.</span>
                  )}
                </span>
              </button>
            </>
          ) : (
            <AgentPanel uc={uc} onBack={() => setView('choice')} onClose={() => close(true)} />
          )}
        </div>
      )}
    </div>
  )
}

function AgentPanel({ uc, onBack, onClose }: { uc: UseCase; onBack: () => void; onClose: () => void }) {
  const [count, setCount] = useState(String(CASES_DEFAULT))
  const [focus, setFocus] = useState('')
  const [copied, setCopied] = useState<'yes' | 'blocked' | null>(null)
  const pre = useRef<HTMLPreElement>(null)
  const timer = useRef<number>(undefined)
  const text = caseAgentInstruction(uc, clamp(count), focus)
  const field = `rounded-md border border-line bg-bg px-2.5 py-1.5 text-[13px] text-fg placeholder:text-faint hover:border-line-strong ${focusRing}`

  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => setCopied(null), [text])

  async function copy() {
    const ok = await copyText(text)
    if (!ok && pre.current) {
      // clipboard blocked: select the text so Cmd+C works
      const r = document.createRange()
      r.selectNodeContents(pre.current)
      window.getSelection()?.removeAllRanges()
      window.getSelection()?.addRange(r)
    }
    setCopied(ok ? 'yes' : 'blocked')
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div>
      <div className="flex items-center gap-1 border-b border-line py-2 pr-2 pl-1.5">
        <button type="button" onClick={onBack} aria-label="Back to the choice" className={`grid size-7 place-items-center rounded-md text-faint hover:bg-line hover:text-fg ${focusRing}`}>
          <Chevron className="rotate-90" />
        </button>
        <h3 className="flex-1 text-[13px] font-medium text-fg">Ask your agent</h3>
        <button type="button" onClick={onClose} aria-label="Close" className={`grid size-7 place-items-center rounded-md text-faint hover:bg-line hover:text-fg ${focusRing}`}>
          <Icon name="x" className="size-3.5" />
        </button>
      </div>

      <div className="space-y-3.5 p-4">
        <div className="flex gap-3">
          <label className="block w-28 shrink-0">
            <span className="mb-1 block text-xs text-muted">How many cases</span>
            <input
              type="number" inputMode="numeric" min={CASES_MIN} max={CASES_MAX} step={1} value={count}
              onChange={(e) => setCount(e.target.value)} onBlur={() => setCount(String(clamp(count)))}
              className={`${field} w-full tabular-nums`}
            />
          </label>
          <label className="block min-w-0 flex-1">
            <span className="mb-1 block text-xs text-muted">Focus <span className="text-faint">(optional)</span></span>
            <input
              value={focus} onChange={(e) => setFocus(e.target.value)} maxLength={300}
              placeholder="edge cases, German documents, long inputs" className={`${field} w-full`}
            />
          </label>
        </div>

        <div>
          <span className="mb-1 block text-xs text-muted">Instruction</span>
          <pre ref={pre} className="max-h-64 overflow-y-auto rounded-md border border-line bg-bg p-3 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap text-muted">{text}</pre>
        </div>

        <div>
          <Button onClick={copy}>
            <Icon name={copied === 'yes' ? 'check' : 'copy'} className="size-3.5" />
            {copied === 'yes' ? 'Copied' : 'Copy instruction'}
          </Button>
          <p className="mt-2 text-xs text-faint" role="status">
            {copied === 'blocked' ? 'Clipboard blocked. The text is selected: press ⌘C.' : 'Paste this into Claude Code / Cursor in your product repo. New cases show up here live.'}
          </p>
        </div>
      </div>
    </div>
  )
}
