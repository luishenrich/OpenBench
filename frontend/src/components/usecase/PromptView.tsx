// Read-only view of what the benchmark sends: system prompt, user template, output schema, tools, params.
// Everything here comes from the coding agent (io_spec); the dashboard only shows it.
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Icon, copyText, focusRing, toast } from '@/components/usecases/kit'
import { promptAttached } from '@/components/usecases/group'
import type { UseCase } from '@/types'

const json = (x: unknown) => JSON.stringify(x, null, 2)
const smallBtn = `inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-raised hover:text-fg ${focusRing}`

function CopyBtn({ text, what }: { text: string; what: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button" className={smallBtn} aria-label={`Copy ${what}`}
      onClick={async () => {
        if (!(await copyText(text))) { toast('Could not copy: the clipboard is blocked in this browser', 'bad'); return }
        setDone(true)
        setTimeout(() => setDone(false), 1500)
      }}
    >
      <Icon name={done ? 'check' : 'copy'} className={`size-3.5 ${done ? 'text-win' : ''}`} />{done ? 'Copied' : 'Copy'}
    </button>
  )
}

function Block({ title, meta, actions, children }: { title: string; meta?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-panel">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-2.5">
        <div className="flex min-w-0 items-baseline gap-2.5">
          <h3 className="text-sm font-medium text-fg">{title}</h3>
          {meta && <span className="truncate text-xs text-faint">{meta}</span>}
        </div>
        <div className="flex items-center gap-1">{actions}</div>
      </header>
      {children}
    </section>
  )
}

// {{var}} placeholders stand out: they are what each test case fills in
function highlightVars(text: string): ReactNode[] {
  return text.split(/(\{\{\s*[\w.-]+\s*\}\})/g).map((part, i) =>
    i % 2 ? <mark key={i} className="rounded-[3px] bg-signal/15 px-0.5 text-signal">{part}</mark> : part)
}

/** Mono text, wrapped, clamped to a max height with "Show all" when it overflows. */
function Clamped({ children, maxH = 'max-h-72' }: { children: ReactNode; maxH?: string }) {
  const ref = useRef<HTMLPreElement>(null)
  const [open, setOpen] = useState(false)
  const [overflows, setOverflows] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (el && !open) setOverflows(el.scrollHeight > el.clientHeight + 2)
  }, [children, open])
  return (
    <div>
      <div className="relative">
        <pre ref={ref} className={`overflow-hidden px-4 py-3.5 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap break-words text-fg/90 ${open ? '' : maxH}`}>
          {children}
        </pre>
        {overflows && !open && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-panel to-transparent" />}
      </div>
      {(overflows || open) && (
        <div className="border-t border-line px-4 py-2">
          <button type="button" className={smallBtn} onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Show less' : 'Show all'}</button>
        </div>
      )}
    </div>
  )
}

function Collapsible({ label, defaultOpen, children }: { label: string; defaultOpen: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <>
      <button type="button" className={`${smallBtn} mx-2 my-1.5`} aria-expanded={open} onClick={() => setOpen(!open)}>
        <svg viewBox="0 0 16 16" className={`size-3 transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
        {open ? `Hide ${label}` : `Show ${label}`}
      </button>
      {open && <div className="border-t border-line">{children}</div>}
    </>
  )
}

const varsOf = (t: string) => [...new Set([...t.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)].map((m) => m[1]))]

export default function PromptView({ uc }: { uc: UseCase }) {
  const io = uc.io_spec
  const tools = io.tools ?? []
  const params = Object.entries(io.params ?? {})
  const schemaText = io.response_schema ? json(io.response_schema) : ''
  const vars = io.user_template ? varsOf(io.user_template) : []

  return (
    <div className="max-w-4xl space-y-6">
      {!promptAttached(uc) ? (
        <div className="rounded-xl border border-dashed border-line-strong px-5 py-8">
          <p className="title">No prompt attached yet</p>
          <p className="mt-1 text-sm text-muted">Your agent attaches it, or it's too large to send inline.</p>
        </div>
      ) : (
        <>
          {io.system_prompt && (
            <Block title="System prompt" meta={`${io.system_prompt.length.toLocaleString()} characters`} actions={<CopyBtn text={io.system_prompt} what="system prompt" />}>
              <Clamped>{highlightVars(io.system_prompt)}</Clamped>
            </Block>
          )}
          {io.user_template && (
            <Block
              title="User template"
              meta={vars.length ? `fills in ${vars.map((v) => `{{${v}}}`).join(', ')} from each test case` : undefined}
              actions={<CopyBtn text={io.user_template} what="user template" />}
            >
              <Clamped>{highlightVars(io.user_template)}</Clamped>
            </Block>
          )}
        </>
      )}

      {io.response_schema && (
        <Block
          title="Output schema"
          meta={Object.keys((io.response_schema.properties as Record<string, unknown>) ?? {}).length ? `${Object.keys(io.response_schema.properties as object).length} fields` : 'JSON Schema'}
          actions={<CopyBtn text={schemaText} what="output schema" />}
        >
          <Collapsible label="schema" defaultOpen={schemaText.split('\n').length <= 40}>
            <Clamped maxH="max-h-[32rem]">{schemaText}</Clamped>
          </Collapsible>
        </Block>
      )}

      {tools.length > 0 && (
        <Block title="Tools" meta={`${tools.length} ${tools.length === 1 ? 'tool' : 'tools'}`} actions={<CopyBtn text={json(tools)} what="tools" />}>
          <ul className="divide-y divide-line">
            {tools.map((t, i) => <ToolRow key={i} tool={t} />)}
          </ul>
        </Block>
      )}

      <Block title="Params" actions={params.length ? <CopyBtn text={json(io.params)} what="params" /> : undefined}>
        {params.length ? (
          <dl className="grid grid-cols-[max-content_1fr] gap-x-8 gap-y-2 px-4 py-3.5 text-sm">
            {params.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="font-mono text-[12.5px] text-muted">{k}</dt>
                <dd className="font-mono text-[12.5px] break-all text-fg">{typeof v === 'string' ? v : JSON.stringify(v)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="px-4 py-3.5 text-sm text-muted">None set: each model runs with its provider defaults.</p>
        )}
      </Block>
    </div>
  )
}

// OpenAI-style tools nest the name under "function"; plain ones carry it at the top
function ToolRow({ tool }: { tool: Record<string, unknown> }) {
  const fn = (tool.function as Record<string, unknown> | undefined) ?? tool
  const name = String(fn.name ?? 'unnamed tool')
  const desc = typeof fn.description === 'string' ? fn.description : null
  return (
    <li>
      <div className="px-4 pt-3">
        <div className="font-mono text-[13px] text-fg">{name}</div>
        {desc && <p className="mt-0.5 text-sm text-muted">{desc}</p>}
      </div>
      <Collapsible label="JSON" defaultOpen={false}>
        <Clamped>{json(tool)}</Clamped>
      </Collapsible>
    </li>
  )
}
