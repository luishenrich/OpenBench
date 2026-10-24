import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui'
import { Icon, focusRing } from '@/components/usecases/kit'
import type { Case, CaseIn, UseCase } from '@/types'
import { ACCEPT, rejectReason, storeFile } from './upload'

type Msg = { role: 'system' | 'user' | 'assistant'; content: string }

/** {{var}} names in the user template, in order of first use */
export function templateVars(uc: UseCase): string[] {
  const t = `${uc.io_spec.user_template ?? ''}`
  return [...new Set([...t.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)].map((m) => m[1]))]
}

const asText = (v: unknown) => (v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v, null, 2))

function fromCase(uc: UseCase, c: Case | null) {
  const vars = templateVars(uc)
  const caseVars = (c?.input.vars ?? {}) as Record<string, unknown>
  const names = [...new Set([...vars, ...Object.keys(caseVars)])]
  const msgs = (c?.input.messages ?? []) as { role?: string; content?: unknown }[]
  const chat = !!msgs.length || (names.length === 0 && (uc.kind === 'chat' || uc.kind === 'agent'))
  return {
    mode: (chat ? 'messages' : 'vars') as 'messages' | 'vars',
    vars: Object.fromEntries((names.length ? names : ['input']).map((n) => [n, asText(caseVars[n])])),
    messages: msgs.length ? msgs.map((m) => ({ role: (m.role as Msg['role']) ?? 'user', content: asText(m.content) })) : [{ role: 'user' as const, content: '' }],
    images: [...(c?.input.images ?? [])],
    reference: asText(c?.reference),
    tags: (c?.tags ?? []).join(', '),
  }
}

/**
 * Add or edit one case. Fields come from io_spec.user_template ({{vars}}), or a messages editor for chat.
 * The reference must be valid JSON when the use case has a response schema.
 */
export default function CaseDrawer({ uc, initial, mode, onClose, onSave }: {
  uc: UseCase
  initial: Case | null
  mode: 'add' | 'edit' | 'duplicate'
  onClose: () => void
  onSave: (body: CaseIn) => Promise<void>
}) {
  const [f, setF] = useState(() => fromCase(uc, initial))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const first = useRef<HTMLTextAreaElement>(null)
  const schema = !!uc.io_spec.response_schema

  useEffect(() => {
    first.current?.focus()
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  let refError: string | null = null
  let refValue: unknown = null
  if (f.reference.trim()) {
    try { refValue = JSON.parse(f.reference) } catch {
      if (schema) refError = 'Not valid JSON. This use case answers in a JSON schema, so the expected output must be JSON.'
      else refValue = f.reference.trim()
    }
  }
  const empty = f.mode === 'vars' ? Object.values(f.vars).every((v) => !v.trim()) && !f.images.length : f.messages.every((m) => !m.content.trim()) && !f.images.length

  async function addImage(files: FileList | null) {
    if (!files?.length) return
    const bad = [...files].map((x) => rejectReason(x)).find(Boolean)
    if (bad) { setErr(bad); return }
    setUploading(true); setErr(null)
    try {
      const urls = await Promise.all([...files].map((x) => storeFile(x, { workspaceId: uc.workspace_id, useCaseId: uc.id })))
      setF((s) => ({ ...s, images: [...s.images, ...urls] }))
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setUploading(false)
    }
  }

  async function save() {
    setBusy(true); setErr(null)
    const input: CaseIn['input'] = f.mode === 'vars'
      ? { vars: Object.fromEntries(Object.entries(f.vars).filter(([, v]) => v !== '')) }
      : { messages: f.messages.filter((m) => m.content.trim()) }
    if (f.images.length) input.images = f.images
    try {
      await onSave({
        input, reference: refValue,
        tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean),
        source: mode === 'edit' && initial ? initial.source : 'upload',
      })
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  const field = `w-full rounded-md border border-line bg-bg px-2.5 py-1.5 text-[13px] text-fg placeholder:text-faint hover:border-line-strong ${focusRing}`
  const title = { add: 'Add case', edit: 'Edit case', duplicate: 'Duplicate case' }[mode]

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="absolute inset-0 cursor-default bg-black/50" onClick={onClose} tabIndex={-1} />
      <div className="relative flex h-full w-[min(560px,100vw)] flex-col border-l border-line bg-panel shadow-2xl shadow-black/60">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="title text-lg">{title}</h2>
            <p className="mt-0.5 text-xs text-faint">
              {f.mode === 'vars' ? <>Fills <span className="font-mono">{'{{…}}'}</span> in the user template.</> : 'Chat messages, oldest first.'}
              {initial && mode === 'edit' && <> Case <span className="font-mono">{initial.id.slice(-6)}</span>.</>}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={`grid size-8 place-items-center rounded-md text-faint hover:bg-raised hover:text-fg ${focusRing}`}><Icon name="x" /></button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <div className="flex gap-1 text-xs" role="radiogroup" aria-label="Input format">
            {(['vars', 'messages'] as const).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={f.mode === m} onClick={() => setF((s) => ({ ...s, mode: m }))}
                className={`rounded-md px-2.5 py-1 ${f.mode === m ? 'bg-raised text-fg' : 'text-muted hover:text-fg'} ${focusRing}`}>
                {m === 'vars' ? 'Template variables' : 'Messages'}
              </button>
            ))}
          </div>

          {f.mode === 'vars' ? (
            <div className="space-y-3">
              {Object.keys(f.vars).map((name, i) => (
                <label key={name} className="block">
                  <span className="mb-1 block font-mono text-xs text-muted">{`{{${name}}}`}</span>
                  <textarea
                    ref={i === 0 ? first : undefined} rows={3} value={f.vars[name]} className={field}
                    onChange={(e) => setF((s) => ({ ...s, vars: { ...s.vars, [name]: e.target.value } }))}
                  />
                </label>
              ))}
              {uc.io_spec.user_template && (
                <details className="text-xs text-faint">
                  <summary className="cursor-pointer hover:text-muted">Show the user template</summary>
                  <pre className="mt-2 max-h-40 overflow-auto rounded-md border border-line bg-bg p-2.5 font-mono text-[11.5px] whitespace-pre-wrap text-muted">{uc.io_spec.user_template}</pre>
                </details>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {f.messages.map((m, i) => (
                <div key={i} className="rounded-md border border-line p-2">
                  <div className="mb-1.5 flex items-center gap-2">
                    <select value={m.role} aria-label={`Role of message ${i + 1}`}
                      onChange={(e) => setF((s) => ({ ...s, messages: s.messages.map((x, j) => (j === i ? { ...x, role: e.target.value as Msg['role'] } : x)) }))}
                      className={`rounded-md border border-line bg-bg px-1.5 py-0.5 text-xs text-muted ${focusRing}`}>
                      <option value="system">system</option><option value="user">user</option><option value="assistant">assistant</option>
                    </select>
                    {f.messages.length > 1 && (
                      <button type="button" className="ml-auto text-xs text-faint hover:text-bad" onClick={() => setF((s) => ({ ...s, messages: s.messages.filter((_, j) => j !== i) }))}>Remove</button>
                    )}
                  </div>
                  <textarea ref={i === 0 ? first : undefined} rows={3} value={m.content} className={field}
                    onChange={(e) => setF((s) => ({ ...s, messages: s.messages.map((x, j) => (j === i ? { ...x, content: e.target.value } : x)) }))} />
                </div>
              ))}
              <button type="button" className="text-xs text-muted hover:text-fg"
                onClick={() => setF((s) => ({ ...s, messages: [...s.messages, { role: s.messages.at(-1)?.role === 'user' ? 'assistant' : 'user', content: '' }] }))}>
                + Add message
              </button>
            </div>
          )}

          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted">Images <span className="text-faint">(optional)</span></span>
              <button type="button" onClick={() => file.current?.click()} disabled={uploading} className="text-muted hover:text-fg disabled:text-faint">
                {uploading ? 'Uploading…' : '+ Add image or PDF'}
              </button>
              <input ref={file} type="file" multiple accept={ACCEPT} className="sr-only" onChange={(e) => { void addImage(e.target.files); e.target.value = '' }} />
            </div>
            {f.images.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {f.images.map((src) => (
                  <div key={src} className="relative">
                    <img src={src} alt="" className="size-16 rounded border border-line object-cover" />
                    <button type="button" aria-label="Remove image" onClick={() => setF((s) => ({ ...s, images: s.images.filter((x) => x !== src) }))}
                      className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full border border-line bg-raised text-faint hover:text-bad">
                      <Icon name="x" className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-faint">None. Images are sent to the models with the text.</p>}
          </div>

          <label className="block">
            <span className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted">Expected output <span className="text-faint">(optional)</span></span>
              {schema && <span className="text-faint">JSON, checked against the response schema</span>}
            </span>
            <textarea
              rows={schema ? 8 : 4} value={f.reference} spellCheck={false}
              onChange={(e) => setF((s) => ({ ...s, reference: e.target.value }))}
              placeholder={schema ? '{ "vendor": "…", "total": 0 }' : 'The answer a good model should give'}
              className={`${field} font-mono text-[12px] ${refError ? 'border-bad/60' : ''}`}
            />
            {refError && <span className="mt-1 block text-xs text-bad">{refError}</span>}
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-muted">Tags <span className="text-faint">(comma-separated)</span></span>
            <input value={f.tags} onChange={(e) => setF((s) => ({ ...s, tags: e.target.value }))} placeholder="edge case, german" className={field} />
          </label>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3.5">
          <span className="min-w-0 text-xs text-bad">{err}</span>
          <div className="flex shrink-0 gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={busy || uploading || !!refError || empty}>{busy ? 'Saving…' : mode === 'edit' ? 'Save case' : 'Add case'}</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
