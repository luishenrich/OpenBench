import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import StartRun from '@/components/StartRun'
import { ErrorNote, Section } from '@/components/ui'
import { api } from '@/lib/api'
import { effortOf } from '@/lib/format'
import type { MetricInfo, Profile, UseCasePatch } from '@/types'
import UseCaseHeader from '@/components/usecase/Header'
import CasesTable, { editedAfterRun } from '@/components/usecase/CasesTable'
import { useEffective } from '@/components/settings/inherit'
import { Toaster } from '@/components/usecases/kit'
import { useNow } from '@/components/usecases/live'
import { promptAttached } from '@/components/usecases/group'
import { ProviderIcon } from '@/components/ModelIcon'
import { ModelName, juryNames } from '@/components/run/ModelName'
import SetupPanel from '@/components/usecase/SetupPanel'
import { hasJudgeMetric, readiness } from '@/components/usecase/readiness'
import { TabBar, TabPanel, useTab } from '@/components/usecase/Tabs'
import Scoring from '@/components/usecase/Scoring'
import PromptView from '@/components/usecase/PromptView'
import { LatestRun, RunsList } from '@/components/usecase/Runs'
import UseCaseSkeleton, { CasesSkeleton } from '@/components/usecase/UseCaseSkeleton'
import { Line } from '@/components/Skeleton'

// Clamped to three lines; "Show more" only when it actually overflows
function Description({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const long = text.length > 260
  return (
    <div className="mt-2.5 max-w-[70ch]">
      <p className={`text-[15px] leading-relaxed text-pretty text-muted ${open || !long ? '' : 'line-clamp-3'}`}>{text}</p>
      {long && (
        <button type="button" onClick={() => setOpen(!open)} className="mt-1 text-sm text-fg/80 underline-offset-4 hover:underline">
          {open ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}

export default function UseCasePage() {
  const { id = '' } = useParams()
  const qc = useQueryClient()
  const uc = useQuery({ queryKey: ['use-case', id], queryFn: () => api.useCase(id), refetchInterval: 4000 })
  const me = useQuery({ queryKey: ['me'], queryFn: api.me })
  const cases = useQuery({ queryKey: ['cases', id], queryFn: () => api.cases(id), refetchInterval: 4000 })
  const runs = useQuery({ queryKey: ['runs', id], queryFn: () => api.runs(id) })
  const metrics = useQuery({ queryKey: ['metrics'], queryFn: api.metrics })
  const [draft, setDraft] = useState<Profile | null>(null)
  const [tab, setTab] = useTab()
  // re-evaluates "your agent is setting this up" without new data, so the page flips once the 5-minute window passes
  const now = useNow(15_000)

  const save = useMutation({
    mutationFn: (profile: Profile) => api.updateUseCase(id, { profile }),
    onSuccess: (updated) => {
      qc.setQueryData(['use-case', id], updated)
      qc.invalidateQueries({ queryKey: ['use-cases'] })
      setDraft(null)
    },
  })

  const eff = useEffective(uc.data, me.data)
  const reset = useMutation({
    mutationFn: (patch: UseCasePatch) => api.updateUseCase(id, patch),
    onSuccess: (updated) => {
      qc.setQueryData(['use-case', id], updated)
      qc.invalidateQueries({ queryKey: ['use-cases'] })
      setDraft(null)
    },
  })

  if (uc.isLoading) return <UseCaseSkeleton tab={tab} />
  if (uc.error) return <ErrorNote error={uc.error} />
  const u = uc.data!
  const profile = draft ?? u.profile ?? me.data?.workspace.default_profile ?? { weights: { quality: 60, speed: 20, cost: 20 }, targets: {} }
  const metricName = (mid: string) => metrics.data?.find((m: MetricInfo) => m.id === mid || m.aliases.includes(mid))?.name ?? mid
  // while the metric catalogue loads, names wait as small skeletons instead of flashing raw ids
  const metricLabel = (mid: string) => (metrics.isLoading ? <Line lh="h-5" bar="h-2.5" className="w-36" /> : metricName(mid))
  const ready = readiness(u, cases.data, now)
  const ref = u.source_refs[0]
  const moreRefs = u.source_refs.length - 1
  const judged = hasJudgeMetric(u)
  const caseCount = cases.data?.length ?? u.case_count
  const casesStale = (cases.data ?? []).some((c) => editedAfterRun(c, u))
  // coral marks what only the user can supply; while the agent is still filling things in, nothing is theirs yet
  const needsCases = caseCount === 0 && !ready.settingUp
  const needsPrompt = !promptAttached(u) && !ready.settingUp

  return (
    <div>
      <UseCaseHeader uc={u} />
      {u.description && <Description text={u.description} />}

      <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-4">
        <div className="min-w-0 bg-panel px-4 py-3">
          <dt className="text-xs text-faint">Called from</dt>
          <dd className="mt-1 truncate font-mono text-[12.5px]" title={u.source_refs.map((r) => `${r.path}:${r.line ?? ''}`).join('\n')}>
            {ref ? `${ref.path}${ref.line ? `:${ref.line}` : ''}` : '–'}
          </dd>
          <dd className="mt-0.5 truncate text-xs text-muted">
            {[ref?.symbol, moreRefs > 0 ? `+${moreRefs} more call ${moreRefs === 1 ? 'site' : 'sites'}` : null].filter(Boolean).join(' · ') || ' '}
          </dd>
        </div>
        <div className="min-w-0 bg-panel px-4 py-3">
          <dt className="text-xs text-faint">Model today</dt>
          <dd className="mt-1">
            {u.current_model
              ? <ModelName model={u.current_model.model} effort={effortOf(u.current_model.model, u.current_model.params)} size={15} nameClass="font-medium text-[15px]" />
              : <span className="text-muted">not set</span>}
          </dd>
          {u.current_model && <dd className="mt-0.5 flex items-center gap-1.5 text-xs text-muted"><ProviderIcon provider={u.current_model.provider} size={11} />via {u.current_model.provider}</dd>}
        </div>
        <div className="bg-panel px-4 py-3">
          <dt className="text-xs text-faint">Test cases</dt>
          <dd className={`title mt-1 text-2xl ${needsCases ? 'text-front' : ''}`}>{caseCount}</dd>
        </div>
        <div className="bg-panel px-4 py-3">
          <dt className="text-xs text-faint">Must pass</dt>
          <dd className="title mt-1 text-2xl">{u.gates.length} <span className="text-sm font-normal text-muted">{u.gates.length === 1 ? 'gate' : 'gates'}</span></dd>
        </div>
      </dl>

      <div className="mt-8">
        <TabBar
          active={tab} onChange={setTab}
          tabs={[
            { key: 'overview', marker: ready.settingUp ? 'live' : null },
            { key: 'cases', count: caseCount, marker: needsCases ? 'attention' : null },
            { key: 'scoring' },
            { key: 'prompt', marker: needsPrompt ? 'attention' : null },
            { key: 'runs', count: runs.data?.length ?? null },
          ]}
        />
      </div>

      <TabPanel tab={tab}>
        {tab === 'overview' && (
          <div className="space-y-8">
            <SetupPanel uc={u} cases={cases.data} now={now} />
            <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
              <LatestRun brief={u.latest_run} />
              <div className="min-w-0">
                <StartRun useCase={u} needsVision={ready.vision} blocked={ready.blocked} />
              </div>
            </div>
          </div>
        )}

        {tab === 'cases' && (
          <Section
            title="Test cases"
            aside={
              <span className="flex flex-wrap items-center gap-x-3">
                {casesStale && <span className="inline-flex items-center gap-1.5 text-xs text-front"><span className="size-1.5 rounded-[1px] bg-front" />Cases edited after the last run</span>}
                <span>{caseCount} cases</span>
              </span>
            }
          >
            {cases.isLoading ? <CasesSkeleton withToolbar /> : <CasesTable uc={u} cases={cases.data} loading={false} />}
          </Section>
        )}

        {tab === 'scoring' && (
          <Scoring
            uc={u} profile={profile} draft={draft} setDraft={setDraft}
            onSave={() => draft && save.mutate(draft)} saving={save.isPending} saveError={save.error}
            inherit={eff ? { profile: eff.profile.source, judge: eff.judge.source } : null}
            resetting={reset.isPending} onReset={(what) => reset.mutate(what === 'profile' ? { profile: null } : { judge: null })}
            metricLabel={metricLabel}
            jury={judged ? juryNames(u, me.data?.workspace.default_judge) : null}
            settingUp={ready.settingUp}
          />
        )}

        {tab === 'prompt' && <PromptView uc={u} />}

        {tab === 'runs' && (
          <Section title="Runs" aside="Every benchmark of this use case, newest first." className="max-w-4xl">
            <RunsList runs={runs.data} loading={runs.isLoading} onStart={() => setTab('overview')} />
          </Section>
        )}
      </TabPanel>
      <Toaster />
    </div>
  )
}
