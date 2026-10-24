import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type DragEvent } from 'react'
import { Button, ErrorNote } from '@/components/ui'
import { api } from '@/lib/api'
import type { Case, UseCase } from '@/types'
import { type Step, type StepStatus, readiness } from './readiness'
import { ACCEPT, parseExamples, rejectReason, uploadCase } from './upload'
import { sinceLabel } from '@/components/usecases/group'
import { LiveDot, useNow } from '@/components/usecases/live'

const ICON: Record<StepStatus, { cls: string; path: string }> = {
  ok: { cls: 'bg-win/15 text-win', path: 'M4 8.5l2.5 2.5L12 5.5' },
  warn: { cls: 'bg-raised text-muted', path: 'M8 4.5v4.5M8 11.5v.01' },
  block: { cls: 'bg-front/15 text-front', path: 'M8 4.5v4.5M8 11.5v.01' },
  wait: { cls: 'bg-raised text-faint', path: 'M5 8h6' },
}

function StepItem({ step, index }: { step: Step; index: number }) {
  const i = ICON[step.status]
  return (
    <li className="flex min-w-0 items-start gap-2.5 bg-panel px-4 py-3">
      <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${i.cls}`} aria-hidden>
        <svg viewBox="0 0 16 16" className="size-3.5"><path d={i.path} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-fg"><span className="sr-only">Step {index + 1}: </span>{step.label}</div>
        <div className={`mt-0.5 truncate text-xs ${step.status === 'block' ? 'text-front' : 'text-muted'}`} title={step.detail}>{step.detail}</div>
      </div>
    </li>
  )
}

/** Setup checklist, with the "Action required" card on top when the user has to supply something.
 *  While the coding agent is still setting the use case up, a calm "your agent is setting this up" panel
 *  replaces the card: missing pieces are on their way, not the user's job. */
export default function SetupPanel({ uc, cases, now }: { uc: UseCase; cases?: Case[]; now: number }) {
  const r = readiness(uc, cases, now)
  const missingCases = (cases?.length ?? uc.case_count) === 0
  const missingPrompt = r.steps.find((s) => s.key === 'prompt')!.status === 'block'
  const [touched, setTouched] = useState(false) // keep the card (and its upload list) after the gap is filled
  const showCard = !r.settingUp && (missingCases || missingPrompt || touched)

  return (
    <section aria-label="Setup" className="space-y-3">
      {r.settingUp && <AgentSettingUp lastChange={r.lastChange} />}
      {showCard && (
        <ActionRequired
          uc={uc} vision={r.vision} missingCases={missingCases} missingPrompt={missingPrompt}
          onAdded={() => setTouched(true)}
        />
      )}
      <ol className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
        {r.steps.map((s, i) => <StepItem key={s.key} step={s} index={i} />)}
      </ol>
    </section>
  )
}

function AgentSettingUp({ lastChange }: { lastChange: number }) {
  const now = useNow(1000)
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 rounded-xl border border-line bg-panel p-5">
      <div className="flex min-w-0 items-start gap-3">
        <LiveDot className="mt-[7px]" />
        <div className="min-w-0">
          <h2 className="title text-lg" role="status">Your agent is setting this up</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">It attaches the prompt, metrics and test cases one by one. This page updates live.</p>
        </div>
      </div>
      <p className="shrink-0 pt-1 text-xs tabular-nums text-faint">last change {sinceLabel(lastChange, now)}</p>
    </div>
  )
}

type Mode = 'paste' | 'generate'

function ActionRequired({ uc, vision, missingCases, missingPrompt, onAdded }: {
  uc: UseCase; vision: boolean; missingCases: boolean; missingPrompt: boolean; onAdded: () => void
}) {
  const qc = useQueryClient()
  const [mode, setMode] = useState<Mode>('paste')
  const refresh = () => {
    for (const key of [['cases', uc.id], ['use-case', uc.id], ['use-cases']]) qc.invalidateQueries({ queryKey: key })
    onAdded()
  }

  const sentence = missingCases && missingPrompt
    ? vision
      ? 'This use case reads page images and the repo has none to test with, and the full prompt is not attached yet.'
      : 'This use case has no test cases yet, and the full prompt is not attached yet.'
    : missingCases
      ? vision ? 'This use case reads page images and the repo has none to test with. Add a few real samples.' : 'This use case has no test cases yet. Paste real examples or generate synthetic ones.'
      : missingPrompt ? 'The full prompt is not attached yet, so the benchmark cannot call the models the way your code does.'
        : 'Cases added. The checklist below is up to date.'
  const done = !missingCases && !missingPrompt

  return (
    <div className={`rounded-xl border p-5 ${done ? 'border-line bg-panel' : 'border-front/40 bg-front/[0.04]'}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className={`title text-lg ${done ? 'text-fg' : 'text-front'}`}>{done ? 'Setup complete' : 'Action required'}</h2>
        {missingCases && !vision && (
          <div className="flex gap-1 text-sm" role="tablist" aria-label="Ways to add cases">
            {(['paste', 'generate'] as Mode[]).map((m) => (
              <button key={m} role="tab" aria-selected={mode === m} type="button" onClick={() => setMode(m)}
                className={`rounded-md px-2.5 py-1 transition-colors ${mode === m ? 'bg-raised text-fg' : 'text-muted hover:text-fg'}`}>
                {{ upload: 'Upload files', paste: 'Paste examples', generate: 'Generate synthetic' }[m]}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="mt-1 max-w-2xl text-sm text-muted">{sentence}</p>

      {missingPrompt && (
        <p className="mt-3 flex items-start gap-2 text-sm text-fg">
          <span className="mt-[7px] size-1.5 shrink-0 rounded-[1px] bg-front" />
          Ask your coding agent to attach the full prompt (it's too large to send inline).
        </p>
      )}

      {vision ? (
        <div className="mt-4"><UploadFiles uc={uc} onAdded={refresh} /></div>
      ) : missingCases && (
        <div className="mt-4">
          {mode === 'paste' ? <PasteExamples uc={uc} onAdded={refresh} /> : <GenerateSynthetic uc={uc} onAdded={refresh} />}
        </div>
      )}
      {vision && missingCases && (
        <p className="mt-3 text-xs text-faint">No synthetic option for image input: invented pages would not tell you how models read your real ones.</p>
      )}
    </div>
  )
}

type Item = { id: string; file: File; preview: string | null; reference: string; showRef: boolean; status: 'ready' | 'uploading' | 'done' | 'error'; error?: string }

function UploadFiles({ uc, onAdded }: { uc: UseCase; onAdded: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<Item[]>([])
  const [over, setOver] = useState(false)
  const [rejected, setRejected] = useState<string[]>([])
  const busy = items.some((i) => i.status === 'uploading')
  const pending = items.filter((i) => i.status === 'ready' || i.status === 'error')

  function add(files: FileList | File[]) {
    const bad: string[] = []
    const next: Item[] = []
    for (const f of Array.from(files)) {
      const why = rejectReason(f)
      if (why) bad.push(`${f.name}: ${why}`)
      else next.push({ id: crypto.randomUUID(), file: f, preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : null, reference: '', showRef: false, status: 'ready' })
    }
    setRejected(bad)
    setItems((xs) => [...xs, ...next])
  }
  const patch = (id: string, p: Partial<Item>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)))

  async function uploadAll() {
    let any = false
    for (const it of pending) {
      patch(it.id, { status: 'uploading', error: undefined })
      try {
        await uploadCase(it.file, { workspaceId: uc.workspace_id, useCaseId: uc.id }, it.reference || null)
        patch(it.id, { status: 'done' })
        any = true
      } catch (e) {
        patch(it.id, { status: 'error', error: e instanceof Error ? e.message : String(e) })
      }
    }
    if (any) onAdded()
  }

  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) add(e.dataTransfer.files) }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={onDrop}
        className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed px-4 py-4 transition-colors ${over ? 'border-front bg-front/[0.06]' : 'border-line-strong bg-bg/40'}`}
      >
        <div className="text-sm">
          <div className="text-fg">Drop page images or PDFs here</div>
          <div className="mt-0.5 text-xs text-faint">PNG, JPEG, WebP or PDF, up to 20 MB each. One case per file.</div>
        </div>
        <Button variant="secondary" type="button" onClick={() => input.current?.click()}>Choose files</Button>
        <input ref={input} type="file" multiple accept={ACCEPT} className="sr-only" onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = '' }} />
      </div>
      <p className="mt-2 text-xs text-muted">These files are sent to the model providers in the benchmark. Use samples you're allowed to share.</p>
      {rejected.length > 0 && <ul className="mt-2 space-y-0.5 text-xs text-bad">{rejected.map((r) => <li key={r}>{r}</li>)}</ul>}

      {items.length > 0 && (
        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-lg border border-line">
          {items.map((it) => (
            <li key={it.id} className="bg-panel px-3 py-2.5">
              <div className="flex items-center gap-3">
                {it.preview
                  ? <img src={it.preview} alt="" className="size-10 shrink-0 rounded border border-line object-cover" />
                  : <span className="grid size-10 shrink-0 place-items-center rounded border border-line text-[10px] text-faint">PDF</span>}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{it.file.name}</div>
                  <div className="text-xs text-faint">{(it.file.size / 1024).toFixed(0)} KB</div>
                </div>
                <span className={`shrink-0 text-xs ${{ ready: 'text-muted', uploading: 'text-signal', done: 'text-win', error: 'text-bad' }[it.status]}`}>
                  {{ ready: 'Ready', uploading: 'Uploading…', done: 'Added as a case', error: 'Failed' }[it.status]}
                </span>
                {it.status === 'ready' && (
                  <button type="button" className="shrink-0 text-xs text-faint hover:text-fg" onClick={() => setItems((xs) => xs.filter((x) => x.id !== it.id))}>Remove</button>
                )}
              </div>
              {it.status === 'uploading' && <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-raised"><div className="h-full w-1/2 animate-pulse rounded-full bg-signal" /></div>}
              {it.error && <p className="mt-1.5 text-xs text-bad">{it.error}</p>}
              {(it.status === 'ready' || it.status === 'error') && (
                it.showRef ? (
                  <textarea
                    value={it.reference} onChange={(e) => patch(it.id, { reference: e.target.value })} rows={2}
                    placeholder="Expected output (optional): the text this page should produce, or JSON"
                    className="mt-2 w-full rounded-md border border-line bg-bg px-2.5 py-1.5 font-mono text-xs text-fg placeholder:text-faint"
                  />
                ) : (
                  <button type="button" onClick={() => patch(it.id, { showRef: true })} className="mt-1.5 text-xs text-muted hover:text-fg">Add expected output</button>
                )
              )}
            </li>
          ))}
        </ul>
      )}
      {pending.length > 0 && (
        <Button className="mt-3" onClick={uploadAll} disabled={busy}>
          {busy ? 'Uploading…' : `Upload ${pending.length} ${pending.length === 1 ? 'file' : 'files'}`}
        </Button>
      )}
    </div>
  )
}

function PasteExamples({ uc, onAdded }: { uc: UseCase; onAdded: () => void }) {
  const [text, setText] = useState('')
  const parsed = parseExamples(text)
  const add = useMutation({
    mutationFn: () => api.addCases(uc.id, parsed.cases.map((c) => ({ ...c, reference: null, source: 'upload' as const, tags: ['pasted'] }))),
    onSuccess: () => { setText(''); onAdded() },
  })
  return (
    <div>
      <textarea
        value={text} onChange={(e) => setText(e.target.value)} rows={6}
        placeholder={'One example per block, separated by a blank line.\n\nOr a JSON array: [{"vars": {"ticket": "…"}}, {"messages": [...]}]'}
        className="w-full rounded-lg border border-line bg-bg px-3 py-2 font-mono text-[12.5px] leading-relaxed text-fg placeholder:text-faint"
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Button onClick={() => add.mutate()} disabled={!parsed.cases.length || add.isPending}>
          {add.isPending ? 'Adding…' : parsed.cases.length ? `Add ${parsed.cases.length} ${parsed.cases.length === 1 ? 'case' : 'cases'}` : 'Add cases'}
        </Button>
        {parsed.error ? <span className="text-xs text-bad">{parsed.error}</span>
          : parsed.cases.length > 0 && <span className="text-xs text-muted">{parsed.cases.length} {parsed.cases.length === 1 ? 'example' : 'examples'} found</span>}
      </div>
      {add.error && <div className="mt-2"><ErrorNote error={add.error} /></div>}
    </div>
  )
}

function GenerateSynthetic({ uc, onAdded }: { uc: UseCase; onAdded: () => void }) {
  const gen = useMutation({ mutationFn: () => api.generateCases(uc.id, { n: 20, strategy: 'auto' }), onSuccess: onAdded })
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={() => gen.mutate()} disabled={gen.isPending}>{gen.isPending ? 'Generating…' : 'Generate 20 synthetic cases'}</Button>
      <span className="text-xs text-muted">Built from the prompt and the response schema. Real examples beat synthetic ones when you have them.</span>
      {gen.error && <div className="w-full"><ErrorNote error={gen.error} /></div>}
    </div>
  )
}
