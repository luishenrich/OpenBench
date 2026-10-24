import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button, Loading, Tag } from '@/components/ui'
import { Checkbox, ConfirmDialog, Icon, RowMenu, focusRing, toast } from '@/components/usecases/kit'
import { api, ApiError } from '@/lib/api'
import type { Case, CaseIn, UseCase } from '@/types'
import CaseDrawer from './CaseDrawer'

const PAGE = 25

function preview(x: unknown, max = 160): string {
  if (x == null || x === '') return '–'
  const s = typeof x === 'string' ? x : JSON.stringify(x)
  return s.length > max ? s.slice(0, max) + '…' : s
}

// vars → their values; chat → the last user message
function inputText(c: Case): string {
  if (c.input.vars && Object.keys(c.input.vars).length) return Object.values(c.input.vars).map((v) => (typeof v === 'string' ? v : JSON.stringify(v))).join(' · ')
  const msgs = (c.input.messages ?? []) as { role?: string; content?: unknown }[]
  const last = [...msgs].reverse().find((m) => m.role === 'user') ?? msgs.at(-1)
  return last ? (typeof last.content === 'string' ? last.content : JSON.stringify(last.content)) : ''
}

const sourceTone = { repo: 'plain', synthetic: 'signal', upload: 'front', trace: 'plain', public: 'plain' } as const

/** Case.updated_at later than the last finished run: edited after it (the run keeps what it ran). */
export function editedAfterRun(c: Pick<Case, 'updated_at'>, uc: Pick<UseCase, 'latest_run'>): boolean {
  const fin = uc.latest_run?.status === 'done' && uc.latest_run.finished_at ? Date.parse(uc.latest_run.finished_at) : 0
  return fin > 0 && !!c.updated_at && Date.parse(c.updated_at) > fin
}

/** Saves an edit with PATCH; an older backend without that route (404/405) gets delete + re-add instead. */
async function saveEdit(uc: UseCase, c: Case, body: CaseIn): Promise<'patched' | 'replaced'> {
  try {
    await api.updateCase(uc.id, c.id, { input: body.input, reference: body.reference ?? null, tags: body.tags ?? [] })
    return 'patched'
  } catch (e) {
    if (!(e instanceof ApiError) || (e.status !== 404 && e.status !== 405)) throw e
    await api.addCases(uc.id, [body])
    await api.deleteCase(uc.id, c.id)
    return 'replaced'
  }
}

export default function CasesTable({ uc, cases, loading }: { uc: UseCase; cases: Case[] | undefined; loading: boolean }) {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [drawer, setDrawer] = useState<{ mode: 'add' | 'edit' | 'duplicate'; c: Case | null } | null>(null)
  const [confirm, setConfirm] = useState<Case[] | null>(null)
  const [deleting, setDeleting] = useState(false)
  const refresh = () => {
    for (const key of [['cases', uc.id], ['use-case', uc.id], ['use-cases']]) qc.invalidateQueries({ queryKey: key })
  }

  const all = cases ?? []
  const needle = q.trim().toLowerCase()
  const filtered = needle
    ? all.filter((c) => `${inputText(c)} ${preview(c.reference, 10_000)} ${c.tags.join(' ')} ${c.source}`.toLowerCase().includes(needle))
    : all
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE))
  const p = Math.min(page, pages - 1)
  const rows = filtered.slice(p * PAGE, (p + 1) * PAGE)
  const selected = all.filter((c) => sel.has(c.id))
  const pageIds = rows.map((c) => c.id)
  const nPageSel = pageIds.filter((id) => sel.has(id)).length
  const toggle = (ids: string[], v: boolean) => setSel((s) => {
    const n = new Set(s)
    ids.forEach((id) => (v ? n.add(id) : n.delete(id)))
    return n
  })

  async function onSave(body: CaseIn) {
    if (drawer?.mode === 'edit' && drawer.c) {
      const how = await saveEdit(uc, drawer.c, body)
      toast(how === 'patched' ? 'Case saved' : 'Case saved. It got a new id: the server cannot edit cases in place yet.')
    } else {
      await api.addCases(uc.id, [body])
      toast(drawer?.mode === 'duplicate' ? 'Case duplicated' : 'Case added')
    }
    setDrawer(null)
    refresh()
  }

  async function onDelete(items: Case[]) {
    setDeleting(true)
    const res = await Promise.allSettled(items.map((c) => api.deleteCase(uc.id, c.id)))
    const failed = res.filter((r) => r.status === 'rejected').length
    setDeleting(false)
    setConfirm(null)
    setSel((s) => new Set([...s].filter((id) => !items.some((c) => c.id === id))))
    refresh()
    const ok = items.length - failed
    if (ok) toast(ok === 1 ? 'Case deleted' : `${ok} cases deleted`)
    if (failed) toast(`${failed} could not be deleted`, 'bad')
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative flex min-w-[200px] flex-1 items-center sm:max-w-xs">
          <Icon name="search" className="pointer-events-none absolute left-2.5 size-3.5 text-faint" />
          <input
            type="search" value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} placeholder="Search cases" aria-label="Search cases"
            className={`w-full rounded-md border border-line bg-panel py-1.5 pr-2 pl-8 text-sm text-fg placeholder:text-faint hover:border-line-strong ${focusRing}`}
          />
        </label>
        {selected.length > 0 && (
          <span className="flex items-center gap-1 text-sm">
            <span className="px-1 text-muted tabular-nums">{selected.length} selected</span>
            <button type="button" onClick={() => setConfirm(selected)} className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-bad hover:bg-bad/15 ${focusRing}`}>
              <Icon name="trash" className="size-3.5" />Delete
            </button>
            <button type="button" onClick={() => setSel(new Set())} className={`rounded-md px-2 py-1 text-muted hover:bg-raised hover:text-fg ${focusRing}`}>Clear</button>
          </span>
        )}
        <Button className="ml-auto" onClick={() => setDrawer({ mode: 'add', c: null })}><Icon name="plus" className="size-3.5" />Add case</Button>
      </div>

      {loading && <Loading />}
      {!loading && all.length === 0 && (
        <p className="rounded-xl border border-dashed border-line-strong px-5 py-8 text-sm text-muted">
          No cases yet. Add one here, use Action required above, or ask your agent to pull them from the repo's tests and fixtures.
        </p>
      )}
      {all.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[720px] table-fixed text-left text-sm">
            <colgroup><col className="w-10" /><col /><col className="w-[30%]" /><col className="w-24" /><col className="w-[16%]" /><col className="w-11" /></colgroup>
            <thead className="bg-panel text-xs text-faint">
              <tr>
                <th className="py-2.5 pl-3"><Checkbox checked={nPageSel > 0 && nPageSel === pageIds.length} indeterminate={nPageSel > 0 && nPageSel < pageIds.length} onChange={(v) => toggle(pageIds, v)} label="Select all cases on this page" /></th>
                <th className="px-3 py-2.5 font-medium">Input</th>
                <th className="px-3 py-2.5 font-medium">Expected</th>
                <th className="px-3 py-2.5 font-medium">Source</th>
                <th className="px-3 py-2.5 font-medium">Tags</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const text = inputText(c)
                return (
                  <tr key={c.id} className={`group/case border-t border-line align-top transition-colors hover:bg-raised ${sel.has(c.id) ? 'bg-signal/[0.06]' : ''}`}>
                    <td className="py-3 pl-3"><Checkbox checked={sel.has(c.id)} onChange={(v) => toggle([c.id], v)} label="Select case" className={sel.size ? '' : 'opacity-0 group-hover/case:opacity-100 focus-visible:opacity-100'} /></td>
                    <td className="cursor-pointer px-3 py-3" onClick={() => setDrawer({ mode: 'edit', c })}>
                      <div className="flex items-start gap-2.5">
                        {c.input.images?.[0] && <img src={c.input.images[0]} alt="" className="size-10 shrink-0 rounded border border-line object-cover" />}
                        <span className="min-w-0">
                          <span className="line-clamp-2">{text ? preview(text) : c.input.images?.length ? <span className="text-muted">{c.input.images.length} image{c.input.images.length > 1 ? 's' : ''}</span> : '–'}</span>
                          {editedAfterRun(c, uc) && <span className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-front"><span className="size-1.5 rounded-[1px] bg-front" />Edited after the last run</span>}
                        </span>
                      </div>
                    </td>
                    <td className="cursor-pointer px-3 py-3 font-mono text-[12px] text-muted" onClick={() => setDrawer({ mode: 'edit', c })}>
                      <span className="line-clamp-3 break-all">{preview(c.reference, 140)}</span>
                    </td>
                    <td className="px-3 py-3"><Tag tone={sourceTone[c.source]}>{c.source}</Tag></td>
                    <td className="px-3 py-3 text-xs text-faint"><span className="line-clamp-2">{c.tags.join(', ') || '–'}</span></td>
                    <td className="py-2.5 pr-2">
                      <RowMenu label="Case actions" items={[
                        { label: 'Edit', icon: 'pencil', onSelect: () => setDrawer({ mode: 'edit', c }) },
                        { label: 'Duplicate', icon: 'duplicate', onSelect: () => setDrawer({ mode: 'duplicate', c }) },
                        { label: 'Delete…', icon: 'trash', danger: true, onSelect: () => setConfirm([c]) },
                      ]} />
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted">
                  No cases match “{q.trim()}”. <button type="button" className="text-fg underline underline-offset-4" onClick={() => setQ('')}>Clear search</button>
                </td></tr>
              )}
            </tbody>
          </table>
          {pages > 1 && (
            <div className="flex items-center justify-between border-t border-line bg-panel px-4 py-2 text-xs text-muted">
              <span className="tabular-nums">{p * PAGE + 1}–{Math.min((p + 1) * PAGE, filtered.length)} of {filtered.length}</span>
              <span className="flex gap-1">
                <button type="button" disabled={p === 0} onClick={() => setPage(p - 1)} className={`rounded-md px-2 py-1 hover:bg-raised hover:text-fg disabled:text-faint disabled:hover:bg-transparent ${focusRing}`}>Previous</button>
                <button type="button" disabled={p >= pages - 1} onClick={() => setPage(p + 1)} className={`rounded-md px-2 py-1 hover:bg-raised hover:text-fg disabled:text-faint disabled:hover:bg-transparent ${focusRing}`}>Next</button>
              </span>
            </div>
          )}
        </div>
      )}

      {drawer && (
        <CaseDrawer
          key={`${drawer.mode}-${drawer.c?.id ?? 'new'}`} uc={uc} initial={drawer.c} mode={drawer.mode}
          onClose={() => setDrawer(null)} onSave={onSave}
        />
      )}
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.length === 1 ? 'Delete this case?' : `Delete ${confirm?.length ?? 0} cases?`}
        body={confirm?.length === 1
          ? <>“{preview(inputText(confirm[0]) || 'image case', 80)}” will be removed from this use case. It can't be undone.</>
          : <>They will be removed from this use case. It can't be undone.</>}
        confirmLabel={confirm?.length === 1 ? 'Delete case' : `Delete ${confirm?.length ?? 0} cases`}
        busy={deleting}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && void onDelete(confirm)}
      />
    </div>
  )
}
