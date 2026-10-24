// Workspace settings: the defaults every use case inherits until it sets its own.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import type { Me, WorkspacePatch } from '@/types'
import { ApiError, api } from '@/lib/api'
import { Button, ErrorNote } from '@/components/ui'
import SettingsSkeleton from '@/components/settings/SettingsSkeleton'
import Weights from '@/components/Weights'
import { HEADER, SettingsSection, inputCls } from '@/components/settings/controls'
import { withDefaults, type FullWorkspace } from '@/components/settings/defaults'
import { Pool, Runs, Targets } from '@/components/settings/fields'
import { Jury } from '@/components/settings/Jury'
import { References } from '@/components/settings/References'

const KEYS = ['name', 'default_profile', 'default_judge', 'default_references', 'candidate_pool', 'default_repeats', 'max_run_cost_usd'] as const
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

function diff(base: FullWorkspace, draft: FullWorkspace): WorkspacePatch {
  const patch: Record<string, unknown> = {}
  for (const k of KEYS) if (!same(base[k], draft[k])) patch[k] = draft[k]
  return patch as WorkspacePatch
}

export default function Settings() {
  const qc = useQueryClient()
  const me = useQuery({ queryKey: ['me'], queryFn: api.me })
  const base = useMemo(() => (me.data ? withDefaults(me.data.workspace) : null), [me.data])
  const [draft, setDraft] = useState<FullWorkspace | null>(null)
  const [saved, setSaved] = useState(false)

  const save = useMutation({
    mutationFn: (patch: WorkspacePatch) => api.updateWorkspace(patch),
    onSuccess: (workspace) => {
      qc.setQueryData<Me>(['me'], (old) => (old ? { ...old, workspace } : old))
      qc.invalidateQueries({ queryKey: ['me'] })
      setDraft(null)
      setSaved(true)
    },
  })

  useEffect(() => {
    if (!saved) return
    const t = setTimeout(() => setSaved(false), 4000)
    return () => clearTimeout(t)
  }, [saved])

  if (me.isLoading) return <SettingsSkeleton />
  if (me.error || !base) return <ErrorNote error={me.error ?? 'No workspace'} />

  const w = draft ?? base
  const patch = diff(base, w)
  const dirty = Object.keys(patch).length > 0
  const set = <K extends keyof FullWorkspace>(key: K, value: FullWorkspace[K]) => {
    setSaved(false)
    save.reset()
    setDraft((prev) => ({ ...(prev ?? base), [key]: value }))
  }
  const notBuilt = save.error instanceof ApiError && (save.error.status === 404 || save.error.status === 405)

  return (
    <div className={dirty ? 'pb-24' : ''}>
      <header className={HEADER}>
        <h1 className="display min-w-0 truncate text-3xl">Settings</h1>
        <p className="text-sm text-muted text-pretty">
          Defaults for every use case in {base.name}. A use case keeps these until you change a setting on its own page.
        </p>
      </header>

      <div className="mt-6">
        <SettingsSection title="Workspace name" help="Shown in the sidebar and on shared reports.">
          <input
            aria-label="Workspace name"
            value={w.name}
            onChange={(e) => set('name', e.target.value)}
            className={`${inputCls} w-full max-w-sm`}
          />
        </SettingsSection>

        <SettingsSection title="Trade-off" help="How much quality, speed and cost matter. Use cases without their own weights use these.">
          <Weights profile={w.default_profile} onChange={(p) => set('default_profile', p)} />
        </SettingsSection>

        <SettingsSection
          title="Targets"
          help="Speed and cost score 1 at the target and 0 at the worst acceptable value. Use cases without their own targets use these."
        >
          <Targets profile={w.default_profile} onChange={(p) => set('default_profile', p)} />
        </SettingsSection>

        <SettingsSection
          id="references"
          title="References"
          help="Closed models every run also measures, on the same cases. They show what you'd give up, and are never ranked or recommended."
        >
          <References value={w.default_references} onChange={(v) => set('default_references', v)} />
        </SettingsSection>

        <SettingsSection
          id="jury"
          title="Judge jury"
          help="Models from different families grade the outputs. A juror sits out when it would grade its own family. Use cases without their own judge use this jury."
        >
          <Jury value={w.default_judge} onChange={(v) => set('default_judge', v)} />
        </SettingsSection>

        <SettingsSection title="Candidate pool" help="Which open-weight models a run picks automatically. You can still add any model by hand.">
          <Pool value={w.candidate_pool} onChange={(v) => set('candidate_pool', v)} />
        </SettingsSection>

        <SettingsSection title="Runs" help="Defaults for new runs. You can change both when you start a run.">
          <Runs
            repeats={w.default_repeats}
            maxCost={w.max_run_cost_usd}
            onRepeats={(n) => set('default_repeats', n)}
            onMaxCost={(v) => set('max_run_cost_usd', v)}
          />
        </SettingsSection>
      </div>

      {saved && !dirty && (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex justify-center px-4 lg:left-(--sidebar-w)">
          <p role="status" className="flex items-center gap-2 rounded-xl border border-line-strong bg-raised/95 px-4 py-3 text-sm text-fg shadow-2xl shadow-black/60 backdrop-blur">
            <span aria-hidden className="size-1.5 rounded-[1px] bg-win" />
            Saved. Use cases that inherit these settings use them on their next run.
          </p>
        </div>
      )}

      {dirty && (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex justify-center px-4 lg:left-(--sidebar-w)">
          <div
            role="region"
            aria-label="Unsaved changes"
            className="pointer-events-auto flex w-full max-w-2xl flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line-strong bg-raised/95 px-4 py-3 shadow-2xl shadow-black/60 backdrop-blur"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm text-fg">
                <span aria-hidden className="size-1.5 rounded-[1px] bg-front" />
                Unsaved changes
              </div>
              {notBuilt ? (
                <div className="mt-0.5 text-xs text-muted">Saving workspace settings needs the backend update (coming from Raphaël). Your changes stay here.</div>
              ) : save.error ? (
                <div className="mt-0.5 text-xs text-bad">{save.error.message}</div>
              ) : null}
            </div>
            <Button variant="ghost" onClick={() => { setDraft(null); save.reset() }} disabled={save.isPending}>Discard</Button>
            <Button onClick={() => save.mutate(patch)} disabled={save.isPending || !w.name.trim()}>
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
